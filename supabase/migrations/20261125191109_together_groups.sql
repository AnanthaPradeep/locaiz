create table public.together_groups (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.sourcing_businesses,
 offer_id uuid not null references public.sourcing_offers,
 title text not null check (char_length(title) between 3 and 120),
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 unit_minor integer check (unit_minor>=0),
 tiers jsonb not null default '[]',
 minimum integer not null check (minimum between 1 and 1000000),
 maximum integer not null check (maximum between minimum and 1000000),
 pledged integer not null default 0 check (pledged between 0 and maximum),
 closes_at timestamptz not null,
 state text not null default 'open' check (state in ('open','accepted','cancelled','expired')),
 created_at timestamptz not null default now()
);
create index together_group_business on public.together_groups(business_id,created_at desc);
create table public.together_participation (
 group_id uuid references public.together_groups,
 buyer_id uuid references auth.users,
 quantity integer not null check (quantity between 1 and 1000000),
 primary key(group_id,buyer_id)
);
create index together_buyer_groups on public.together_participation(buyer_id,group_id);
create table public.together_audit (
 id bigint generated always as identity primary key,
 group_id uuid not null references public.together_groups,
 actor uuid not null references auth.users,
 action text not null,
 previous_quantity integer,
 next_quantity integer,
 created_at timestamptz not null default now()
);
create index together_audit_group on public.together_audit(group_id,id);
alter table public.together_groups enable row level security;
alter table public.together_participation enable row level security;
alter table public.together_audit enable row level security;
revoke all on public.together_groups, public.together_participation, public.together_audit from public,anon,authenticated;
grant select on public.together_groups to anon,authenticated;
grant select on public.together_participation to authenticated;
create policy together_public on public.together_groups for select to anon,authenticated using (
 exists(select 1 from public.sourcing_businesses b where b.id=business_id and b.published and b.trust_state='verified'));
create policy together_seller on public.together_groups for select to authenticated using (sourcing_private.can_manage(business_id));
create policy together_buyer on public.together_participation for select to authenticated using (buyer_id=(select auth.uid()));

create function sourcing_private.together_action(command text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 actor_id uuid:=auth.uid();
 group_key uuid:=(payload->>'id')::uuid;
 offer_key uuid;
 g public.together_groups;
 o public.sourcing_offers;
 old_qty int;
 qty int;
 minimum_qty int;
 maximum_qty int;
 expires_at timestamptz;
 seller boolean;
 next_state text;
 grouped_tiers jsonb;
begin
 if actor_id is null or not exists(select 1 from auth.users where id=actor_id and email_confirmed_at is not null)
  then raise exception 'Verified account required' using errcode='42501';end if;
 if command='create' then
   offer_key:=(payload->>'offer')::uuid;
   select * into o from public.sourcing_offers where id=offer_key and published
     and (sourcing_offers.expires_at is null or sourcing_offers.expires_at>clock_timestamp());
   if not found or not sourcing_private.can_manage(o.business_id)
     or not exists(select 1 from public.sourcing_businesses b where b.id=o.business_id and b.published and b.trust_state='verified')
     then raise exception 'Published offer from a verified managed business required' using errcode='42501';end if;
   minimum_qty:=(payload->>'minimum')::int;
   maximum_qty:=(payload->>'maximum')::int;
   expires_at:=(payload->>'closes')::timestamptz;
   if minimum_qty<o.minimum_quantity or (o.maximum_quantity is not null and maximum_qty>o.maximum_quantity)
     or expires_at<=clock_timestamp() or expires_at>clock_timestamp()+interval '90 days'
     or (o.expires_at is not null and expires_at>o.expires_at)
     then raise exception 'Group quantities and deadline must fit the offer';end if;
   select coalesce(jsonb_agg(jsonb_build_object('quantity',quantity,'minor',unit_price_minor) order by quantity),'[]')
     into grouped_tiers from public.sourcing_price_tiers where offer_id=offer_key and quantity<=maximum_qty;
   insert into public.together_groups(id,business_id,offer_id,title,currency,unit_minor,tiers,minimum,maximum,closes_at)
   values(group_key,o.business_id,o.id,trim(payload->>'title'),o.currency,o.unit_price_minor,grouped_tiers,minimum_qty,maximum_qty,expires_at)
   on conflict(id) do nothing;
   if found then
     insert into public.together_audit(group_id,actor,action) values(group_key,actor_id,'created');
   elsif not exists(select 1 from public.together_groups where id=group_key and business_id=o.business_id and offer_id=o.id) then
     raise exception 'Group unavailable' using errcode='42501';
   end if;
   return group_key;
 end if;
 select * into g from public.together_groups where id=group_key for update;
 if not found then raise exception 'Group unavailable';end if;
 seller:=sourcing_private.can_manage(g.business_id);
 if command='quantity' then
   if g.state<>'open' or g.closes_at<=clock_timestamp() then raise exception 'Group participation is closed';end if;
   if sourcing_private.market_role(g.business_id) is not null
     or not exists(select 1 from public.sourcing_businesses b where b.id=g.business_id and b.published and b.trust_state='verified')
     then raise exception 'Group participation unavailable' using errcode='42501';end if;
   qty:=(payload->>'quantity')::int;
   if qty is null or qty not between 0 and g.maximum then raise exception 'Invalid quantity';end if;
   select quantity into old_qty from public.together_participation where group_id=group_key and buyer_id=actor_id;
   old_qty:=coalesce(old_qty,0);
   if old_qty=qty then return group_key;end if;
   if g.pledged-old_qty+qty>g.maximum then raise exception 'Group quantity limit reached';end if;
   if qty=0 then delete from public.together_participation where group_id=group_key and buyer_id=actor_id;
   else
     insert into public.together_participation(group_id,buyer_id,quantity) values(group_key,actor_id,qty)
       on conflict(group_id,buyer_id) do update set quantity=excluded.quantity;
   end if;
   update public.together_groups set pledged=g.pledged-old_qty+qty where id=group_key;
   insert into public.together_audit(group_id,actor,action,previous_quantity,next_quantity) values(group_key,actor_id,'quantity',old_qty,qty);
 elsif seller and command in ('accept','cancel','expire') then
   next_state:=case command when 'accept' then 'accepted' when 'cancel' then 'cancelled' else 'expired' end;
   if g.state=next_state then return group_key;end if;
   if g.state<>'open' then raise exception 'Group is closed';end if;
   if command='accept' and (g.pledged<g.minimum or g.closes_at<=clock_timestamp() or not exists(
     select 1 from public.sourcing_businesses b where b.id=g.business_id and b.published and b.trust_state='verified'))
     then raise exception 'An active group must reach its minimum before supplier acceptance';end if;
   if command='expire' and g.closes_at>clock_timestamp() then raise exception 'The deadline has not passed';end if;
   update public.together_groups set state=next_state where id=group_key;
   insert into public.together_audit(group_id,actor,action) values(group_key,actor_id,next_state);
 else raise exception 'Group action unavailable' using errcode='42501';
 end if;
 return group_key;
end;
$$;
create function public.together_action(command text,payload jsonb) returns uuid
language sql security invoker set search_path='' as $$ select sourcing_private.together_action(command,payload); $$;
revoke all on function public.together_action(text,jsonb), sourcing_private.together_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.together_action(text,jsonb), sourcing_private.together_action(text,jsonb) to authenticated;
