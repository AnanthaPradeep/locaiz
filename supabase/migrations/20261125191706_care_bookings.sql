create table public.care_services (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.sourcing_businesses,
 title text not null check(char_length(title) between 3 and 120),
 category text not null check(category in ('Repair','Installation','Maintenance','Consultation')),
 coverage text not null check(char_length(coverage) between 2 and 160),
 description text not null check(char_length(description) between 3 and 1500),
 estimate_minor integer check(estimate_minor>=0), currency text not null check(currency~'^[A-Z]{3}$'),
 published boolean not null default true
);
create index care_services_business on public.care_services(business_id);
create table public.care_slots (
 id uuid primary key default gen_random_uuid(),service_id uuid not null references public.care_services,
 starts_at timestamptz not null,ends_at timestamptz not null,
 taken boolean not null default false,check(ends_at>starts_at),unique(service_id,starts_at)
);
create index care_slots_service on public.care_slots(service_id,starts_at);
create table public.care_bookings (
 id uuid primary key default gen_random_uuid(),service_id uuid not null references public.care_services,
 slot_id uuid not null references public.care_slots,buyer_id uuid not null references auth.users,
 note text not null check(char_length(note)<=1000),
 status text not null default 'requested' check(status in ('requested','accepted','in_service','completed','cancelled','declined')),
 rating smallint check(rating between 1 and 5),created_at timestamptz not null default now()
);
create index care_bookings_buyer on public.care_bookings(buyer_id,created_at desc);
create index care_bookings_service on public.care_bookings(service_id,created_at desc);
create unique index care_active_slot on public.care_bookings(slot_id) where status in ('requested','accepted','in_service','completed');
create table public.care_messages (
 id bigint generated always as identity primary key,booking_id uuid not null references public.care_bookings,
 author_id uuid not null references auth.users,side text not null check(side in ('buyer','provider')),
 body text not null check(char_length(trim(body)) between 1 and 2000),created_at timestamptz not null default now(),
 client_key uuid not null,unique(booking_id,author_id,client_key)
);
create index care_messages_booking on public.care_messages(booking_id,id desc);
create index care_messages_author on public.care_messages(author_id,created_at desc);
create table sourcing_private.care_booking_audit (
 id bigint generated always as identity primary key,booking_id uuid not null references public.care_bookings,
 actor_id uuid not null references auth.users,kind text not null,created_at timestamptz not null default now()
);
revoke all on sourcing_private.care_booking_audit from public,anon,authenticated;
alter table sourcing_private.care_booking_audit enable row level security;
alter table public.care_services enable row level security;
alter table public.care_slots enable row level security;
alter table public.care_bookings enable row level security;
alter table public.care_messages enable row level security;
revoke all on public.care_services,public.care_slots,public.care_bookings,public.care_messages from public,anon,authenticated;
grant select on public.care_services,public.care_slots to anon,authenticated;
grant select on public.care_bookings to authenticated;
grant select(id,booking_id,side,body,created_at) on public.care_messages to authenticated;
create policy care_public_services on public.care_services for select to anon,authenticated using(
 published and exists(select 1 from public.sourcing_businesses b where b.id=business_id and b.published and b.trust_state='verified'));
create policy care_managed_services on public.care_services for select to authenticated using(sourcing_private.can_manage(business_id));
create policy care_visible_slots on public.care_slots for select to anon,authenticated using(
 exists(select 1 from public.care_services s where s.id=service_id));
create policy care_participant_booking on public.care_bookings for select to authenticated using(
 buyer_id=(select auth.uid()) or exists(select 1 from public.care_services s where s.id=service_id and sourcing_private.can_manage(s.business_id)));
create policy care_participant_message on public.care_messages for select to authenticated using(
 exists(select 1 from public.care_bookings b where b.id=booking_id));

create function sourcing_private.care_action(command text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 actor_id uuid:=auth.uid();
 key_id uuid:=nullif(payload->>'id','')::uuid;
 service_key uuid:=nullif(payload->>'service','')::uuid;
 slot_key uuid:=nullif(payload->>'slot','')::uuid;
 sale public.care_services;
 slot public.care_slots;
 booking public.care_bookings;
 seller boolean;
 buyer boolean;
 begins timestamptz;
 ends timestamptz;
 state text:=payload->>'state';
 message_key uuid:=nullif(payload->>'requestKey','')::uuid;
begin
 if actor_id is null or not exists(select 1 from auth.users where id=actor_id and email_confirmed_at is not null)
   then raise exception 'Verified account required' using errcode='42501';end if;
 if command='publish' then
   if not sourcing_private.can_manage(service_key) or not exists(select 1 from public.sourcing_businesses b where b.id=service_key and b.published and b.trust_state='verified' and 'Service provider'=any(b.roles))
   then raise exception 'Verified service business manager required' using errcode='42501';end if;
   insert into public.care_services(id,business_id,title,category,coverage,description,estimate_minor,currency)
   values(key_id,service_key,trim(payload->>'title'),payload->>'category',trim(payload->>'coverage'),trim(payload->>'description'),nullif(payload->>'estimate','')::int,upper(payload->>'currency'))
   on conflict(id) do nothing;
   if not found and not exists(select 1 from public.care_services where id=key_id and business_id=service_key)
     then raise exception 'Service unavailable' using errcode='42501';end if;
   return key_id;
 end if;
 if command not in ('slot','request') then
   select * into booking from public.care_bookings where id=key_id for update;
   if not found then raise exception 'Booking unavailable';end if;
   service_key:=booking.service_id;
   buyer:=booking.buyer_id=actor_id;
 end if;
 select * into sale from public.care_services where id=service_key;
 if not found then raise exception 'Service unavailable';end if;
 seller:=sourcing_private.can_manage(sale.business_id);
 if command='slot' then
   if not seller then raise exception 'Service manager required' using errcode='42501';end if;
   begins:=(payload->>'start')::timestamptz; ends:=(payload->>'end')::timestamptz;
   if begins is null or ends is null or begins<=clock_timestamp() or ends<=begins or ends-begins>interval '1 day'
      or begins>clock_timestamp()+interval '90 days' then raise exception 'Choose a valid future appointment window';end if;
   perform pg_advisory_xact_lock(hashtextextended(sale.business_id::text,3141));
   if exists(select 1 from public.care_slots s where s.id=key_id and s.service_id=sale.id and s.starts_at=begins and s.ends_at=ends) then return key_id;end if;
   if exists(select 1 from public.care_slots s join public.care_services p on p.id=s.service_id
      where p.business_id=sale.business_id and s.starts_at<ends and s.ends_at>begins)
      then raise exception 'Appointment overlaps provider availability';end if;
   insert into public.care_slots(id,service_id,starts_at,ends_at) values(key_id,sale.id,begins,ends);
   return key_id;
 end if;
 if command in ('request','reschedule') then
   if sourcing_private.market_role(sale.business_id) is not null or not sale.published
     or not exists(select 1 from public.sourcing_businesses b where b.id=sale.business_id and b.published and b.trust_state='verified')
     then raise exception 'Service booking unavailable' using errcode='42501';end if;
   if command='request' and exists(select 1 from public.care_bookings b where b.id=key_id and b.buyer_id=actor_id and b.service_id=sale.id) then return key_id;end if;
   if command='reschedule' and (not buyer or booking.status not in ('requested','accepted')) then raise exception 'Rescheduling unavailable' using errcode='42501';end if;
   if command='reschedule' and slot_key=booking.slot_id then return key_id;end if;
   perform pg_advisory_xact_lock(hashtextextended(sale.business_id::text,3141));
   select * into slot from public.care_slots where id=slot_key and service_id=sale.id for update;
   if not found or slot.starts_at<=clock_timestamp() or slot.taken then raise exception 'Appointment is unavailable';end if;
   if command='request' then
     insert into public.care_bookings(id,service_id,slot_id,buyer_id,note)
     values(key_id,sale.id,slot_key,actor_id,trim(coalesce(payload->>'note','')));
   else
     update public.care_slots set taken=false where id=booking.slot_id;
     update public.care_bookings set slot_id=slot_key,status='requested' where id=key_id;
   end if;
   update public.care_slots set taken=true where id=slot_key;
 elsif command='transition' then
   if not (seller or buyer) then raise exception 'Booking participant required' using errcode='42501';end if;
   if booking.status=state then return key_id;end if;
   if not coalesce(((seller or buyer) and state='cancelled' and booking.status in ('requested','accepted'))
     or (seller and ((state in ('accepted','declined') and booking.status='requested')
       or (state='in_service' and booking.status='accepted') or (state='completed' and booking.status='in_service'))),false)
     then raise exception 'Booking transition is unavailable' using errcode='42501';end if;
   if state='accepted' and not exists(select 1 from public.care_slots where id=booking.slot_id and ends_at>clock_timestamp())
     then raise exception 'The appointment has expired';end if;
   if state='in_service' and not exists(select 1 from public.care_slots where id=booking.slot_id and starts_at<=clock_timestamp())
     then raise exception 'The appointment has not started';end if;
   update public.care_bookings set status=state where id=key_id;
   if state in ('declined','cancelled') then update public.care_slots set taken=false where id=booking.slot_id;end if;
 elsif command='message' then
   if not(seller or buyer) then raise exception 'Booking participant required' using errcode='42501';end if;
   if exists(select 1 from public.care_messages m where m.booking_id=key_id and m.author_id=actor_id and m.client_key=message_key)
     then return key_id;end if;
   perform pg_advisory_xact_lock(hashtextextended(actor_id::text,3142));
   if (select count(*) from public.care_messages m where m.author_id=actor_id and m.created_at>clock_timestamp()-interval '1 minute')>=20
     then raise exception 'Message limit reached';end if;
   insert into public.care_messages(booking_id,author_id,side,body,client_key)
     values(key_id,actor_id,case when buyer then 'buyer' else 'provider' end,trim(payload->>'body'),message_key);
   return key_id;
 elsif command='review' then
   if not buyer or booking.status<>'completed' or booking.rating is not null then
     raise exception 'One rating per completed booking is permitted' using errcode='42501';end if;
   if coalesce((payload->>'rating')::int,0) not between 1 and 5 then raise exception 'Choose a rating between 1 and 5';end if;
   update public.care_bookings set rating=(payload->>'rating')::smallint where id=key_id;
 else raise exception 'Unknown care action';
 end if;
 insert into sourcing_private.care_booking_audit(booking_id,actor_id,kind) values(key_id,actor_id,case when command='transition' then state else command end);
 return key_id;
end;
$$;
create function public.care_action(command text,payload jsonb) returns uuid
language sql security invoker set search_path='' as $$ select sourcing_private.care_action(command,payload); $$;
revoke all on function public.care_action(text,jsonb),sourcing_private.care_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.care_action(text,jsonb),sourcing_private.care_action(text,jsonb) to authenticated;
