
create table public.stock_shop_inventory (
 shop_id uuid references public.stock_businesses,
 product_id text, variant text, pilot_id text not null,
 on_hand int not null check (on_hand between 0 and 9999),
 enabled boolean not null default false,
 primary key(shop_id,product_id,variant),
 foreign key(pilot_id,product_id,variant) references public.stock_products
);
create table public.stock_pickup_windows (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null, product_id text not null, variant text not null,
 starts_at timestamptz not null, ends_at timestamptz not null,
 capacity int not null check (capacity between 1 and 9999),
 foreign key(shop_id,product_id,variant) references public.stock_shop_inventory,
 check(ends_at>starts_at),
 unique(shop_id,product_id,variant,starts_at,ends_at)
);
create table public.stock_reservations (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.stock_request_shops,
 window_id uuid not null references public.stock_pickup_windows,
 buyer_id uuid not null references auth.users,
 shop_id uuid not null references public.stock_businesses,
 quantity int not null check (quantity between 1 and 99),
 status text not null default 'requested' check (status in ('requested','approved','ready','declined','collected','cancelled','expired')),
 instructions text not null default '' check(char_length(instructions)<=500),
 created_at timestamptz not null default now()
);
create index stock_reservation_assignment on public.stock_reservations(assignment_id);
create index stock_reservation_window on public.stock_reservations(window_id,status);
create unique index stock_reservation_open on public.stock_reservations(assignment_id)
 where status in ('requested','approved','ready');
create table public.stock_reservation_audit (
 id bigint generated always as identity primary key,
 reservation_id uuid not null references public.stock_reservations,
 actor uuid not null references auth.users,
 status text not null,
 created_at timestamptz not null default now()
);
create index stock_reservation_audit_key on public.stock_reservation_audit(reservation_id,id);

create function stock_private.reservation_member(shop uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from stock_private.business_members m where m.business_id=shop and m.user_id=auth.uid());
$$;
create function stock_private.pickup_window_read(shop uuid, product text, sku text) returns boolean
language sql stable security definer set search_path='' as $$
 select stock_private.reservation_member(shop) or exists(
  select 1 from public.stock_requests r join public.stock_request_shops a on a.request_id=r.id
   join public.stock_shop_inventory i on i.shop_id=a.business_id and i.product_id=r.product_id and i.variant=r.variant
  where r.buyer_id=auth.uid() and a.business_id=shop and r.product_id=product and r.variant=sku
    and a.status='available' and a.available_quantity is not null and i.enabled
    and r.cancelled_at is null and least(r.expires_at,coalesce(a.quote_expires_at,r.expires_at))>now()
 );
$$;
revoke all on function stock_private.reservation_member(uuid),stock_private.pickup_window_read(uuid,text,text)
 from public,anon,authenticated;
grant execute on function stock_private.reservation_member(uuid),stock_private.pickup_window_read(uuid,text,text) to authenticated;

alter table public.stock_shop_inventory enable row level security;
alter table public.stock_pickup_windows enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.stock_reservation_audit enable row level security;
revoke all on public.stock_shop_inventory,public.stock_pickup_windows,public.stock_reservations,public.stock_reservation_audit from public,anon,authenticated;
grant select on public.stock_shop_inventory,public.stock_pickup_windows,public.stock_reservations,public.stock_reservation_audit to authenticated;
create policy stock_inventory_read on public.stock_shop_inventory for select to authenticated using (stock_private.reservation_member(shop_id));
create policy stock_windows_read on public.stock_pickup_windows for select to authenticated using (stock_private.pickup_window_read(shop_id,product_id,variant));
create policy stock_reservations_read on public.stock_reservations for select to authenticated
 using (buyer_id=(select auth.uid()) or stock_private.reservation_member(shop_id));
create policy stock_reservation_audit_read on public.stock_reservation_audit for select to authenticated
 using (exists(select 1 from public.stock_reservations r where r.id=reservation_id));

create function stock_private.pickup_held(shop uuid, product text, sku text, window_only uuid default null) returns int
language sql stable security invoker set search_path='' as $$
 select coalesce(sum(r.quantity),0)::int from public.stock_reservations r join public.stock_pickup_windows w on w.id=r.window_id
 where w.shop_id=shop and w.product_id=product and w.variant=sku and r.status in ('approved','ready')
   and w.ends_at>now() and (window_only is null or w.id=window_only);
$$;
revoke all on function stock_private.pickup_held(uuid,text,text,uuid) from public,anon,authenticated;

create function stock_private.check_inventory_reply() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.stock_requests; inventory public.stock_shop_inventory;
begin
 if new.status<>'available' then return new; end if;
 select * into r from public.stock_requests where id=new.request_id;
 select * into inventory from public.stock_shop_inventory where shop_id=new.business_id and product_id=r.product_id and variant=r.variant for update;
 if found and (new.available_quantity is null or new.available_quantity>
   inventory.on_hand-stock_private.pickup_held(new.business_id,r.product_id,r.variant)) then
  raise exception 'Reply quantity exceeds unreserved shop inventory';
 end if;
 return new;
end;
$$;
revoke all on function stock_private.check_inventory_reply() from public,anon,authenticated;
create trigger stock_validate_inventory_reply before update of available_quantity,status on public.stock_request_shops
 for each row execute function stock_private.check_inventory_reply();

create function stock_private.pickup_action(command text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 actor_id uuid:=auth.uid();
 assignment_key uuid:=nullif(payload->>'assignment','')::uuid;
 target_id uuid:=nullif(payload->>'id','')::uuid;
 window_key uuid:=nullif(payload->>'window','')::uuid;
 qty int:=nullif(payload->>'quantity','')::int;
 next_status text:=payload->>'state';
 assignment_row public.stock_request_shops;
 request_row public.stock_requests;
 inventory public.stock_shop_inventory;
 window_row public.stock_pickup_windows;
 reservation public.stock_reservations;
 seller boolean;
 buyer boolean;
 valid_confirmation boolean;
begin
 if actor_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if command='transition' then
   select * into reservation from public.stock_reservations where id=target_id for update;
   if not found then raise exception 'Reservation unavailable' using errcode='42501'; end if;
   assignment_key:=reservation.assignment_id;
   window_key:=reservation.window_id;
   qty:=reservation.quantity;
 end if;
 select * into assignment_row from public.stock_request_shops where id=assignment_key;
 if not found then raise exception 'Stock assignment unavailable' using errcode='42501'; end if;
 select * into request_row from public.stock_requests where id=assignment_row.request_id;
 seller:=stock_private.reservation_member(assignment_row.business_id);
 buyer:=request_row.buyer_id=actor_id;
 if not (buyer or seller) then raise exception 'Reservation access denied' using errcode='42501'; end if;
 valid_confirmation:=assignment_row.status='available' and assignment_row.available_quantity is not null
    and request_row.cancelled_at is null and least(request_row.expires_at,coalesce(assignment_row.quote_expires_at,request_row.expires_at))>clock_timestamp();
 if command='inventory' and seller then
   insert into public.stock_shop_inventory(shop_id,product_id,variant,pilot_id,on_hand,enabled)
     values(assignment_row.business_id,request_row.product_id,request_row.variant,request_row.pilot_id,qty,coalesce((payload->>'enabled')::boolean,false))
     on conflict(shop_id,product_id,variant) do update set on_hand=excluded.on_hand,enabled=excluded.enabled
     returning * into inventory;
   if qty<stock_private.pickup_held(inventory.shop_id,inventory.product_id,inventory.variant) then raise exception 'Inventory is below active holds'; end if;
   perform stock_private.signal(request_row.id);
   return assignment_key;
 end if;
 select * into inventory from public.stock_shop_inventory where shop_id=assignment_row.business_id
    and product_id=request_row.product_id and variant=request_row.variant for update;
 if not found then raise exception 'This shop has not configured reservations'; end if;
 if command='window' and seller then
   if not inventory.enabled or (payload->>'start')::timestamptz<=clock_timestamp() then raise exception 'Choose a future pickup window'; end if;
   insert into public.stock_pickup_windows(shop_id,product_id,variant,starts_at,ends_at,capacity)
     values(inventory.shop_id,inventory.product_id,inventory.variant,(payload->>'start')::timestamptz,(payload->>'end')::timestamptz,qty)
     returning id into target_id;
   perform stock_private.signal(request_row.id);
   return target_id;
 end if;
 select * into window_row from public.stock_pickup_windows where id=window_key and shop_id=inventory.shop_id
   and product_id=inventory.product_id and variant=inventory.variant;
 if not found then raise exception 'Pickup window unavailable'; end if;
 if command='reserve' and buyer then
   if not inventory.enabled or not valid_confirmation or qty is null or qty>least(request_row.quantity,assignment_row.available_quantity)
      or window_row.starts_at<=clock_timestamp() or window_row.starts_at<assignment_row.ready_at
     then raise exception 'A valid stock confirmation, quantity and future window are required'; end if;
   update public.stock_reservations set status='expired' where assignment_id=assignment_key and status='requested'
     and window_id in (select id from public.stock_pickup_windows where ends_at<=clock_timestamp());
   select id into target_id from public.stock_reservations where assignment_id=assignment_key and status in ('requested','approved','ready');
   if found then return target_id; end if;
   insert into public.stock_reservations(assignment_id,window_id,buyer_id,shop_id,quantity)
     values(assignment_key,window_key,actor_id,inventory.shop_id,qty) returning id into target_id;
   next_status:='requested';
 elsif command='transition' then
   if next_status='approved' and seller and reservation.status='requested' then
     if not valid_confirmation or not inventory.enabled or window_row.starts_at<=clock_timestamp()
        or qty>assignment_row.available_quantity
        or qty+stock_private.pickup_held(inventory.shop_id,inventory.product_id,inventory.variant)>inventory.on_hand
        or qty+stock_private.pickup_held(inventory.shop_id,inventory.product_id,inventory.variant,window_key)>window_row.capacity
       then raise exception 'Confirmation expired or available stock/window capacity is insufficient'; end if;
   elsif next_status='declined' and seller and reservation.status='requested' then null;
   elsif next_status='ready' and seller and reservation.status='approved' and window_row.ends_at>clock_timestamp() then null;
   elsif next_status='collected' and seller and reservation.status='ready' and window_row.ends_at>clock_timestamp() then
     update public.stock_shop_inventory set on_hand=on_hand-qty where shop_id=inventory.shop_id and product_id=inventory.product_id and variant=inventory.variant;
   elsif next_status='cancelled' and (buyer or seller) and reservation.status in ('requested','approved') and window_row.starts_at>clock_timestamp() then null;
   elsif next_status='expired' and reservation.status in ('requested','approved','ready') and window_row.ends_at<=clock_timestamp() then null;
   else raise exception 'Reservation transition unavailable' using errcode='42501'; end if;
   update public.stock_reservations set status=next_status,
     instructions=case when seller and payload ? 'instructions' then left(coalesce(payload->>'instructions',''),500) else instructions end
     where id=target_id;
 else raise exception 'Reservation permission required' using errcode='42501'; end if;
 insert into public.stock_reservation_audit(reservation_id,actor,status) values(target_id,actor_id,next_status);
 perform stock_private.signal(request_row.id);
 return target_id;
end;
$$;
create function public.pickup_action(command text,payload jsonb) returns uuid
language sql security invoker set search_path='' as $$ select stock_private.pickup_action(command,payload); $$;
revoke all on function public.pickup_action(text,jsonb),stock_private.pickup_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.pickup_action(text,jsonb),stock_private.pickup_action(text,jsonb) to authenticated;
