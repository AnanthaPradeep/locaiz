
-- Operational RFQs and conversations reuse Phase 1 businesses and membership.
create table public.journey_rfqs (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users,
  submission uuid not null,
  title text not null check (char_length(trim(title)) between 3 and 120),
  specifications text not null check (char_length(specifications)<=3000),
  product_id text references public.sourcing_products,
  variant_id text,
  quantity int not null check (quantity between 1 and 1000000),
  unit text not null check (unit in ('units','sets','pairs')),
  destination text not null check (char_length(trim(destination)) between 2 and 120),
  deadline date,
  budget_minor bigint check (budget_minor between 0 and 999999999999),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  custom boolean not null default false,
  created_at timestamptz not null default now(),
  unique (buyer_id,submission),
  foreign key(product_id,variant_id) references public.sourcing_variants
);
create table public.journey_threads (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.journey_rfqs,
  business_id uuid not null references public.sourcing_businesses,
  invite_state text not null default 'invited' check (invite_state in ('invited','accepted','declined')),
  quote_state text not null default 'draft' check (quote_state in ('draft','submitted','under_discussion','revised','selected','confirmed','declined','withdrawn')),
  latest_quote uuid,
  selected_quote uuid,
  confirmed_quote uuid,
  updated_at timestamptz not null default now(),
  unique(rfq_id,business_id)
);
create index journey_thread_business on public.journey_threads(business_id,updated_at desc);
create index journey_rfq_buyer on public.journey_rfqs(buyer_id,created_at desc);
create table public.journey_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.journey_threads,
  author uuid not null references auth.users,
  side text not null check (side in ('buyer','seller')),
  client_key uuid not null,
  body text not null check (char_length(body)<=3000),
  attachment text,
  created_at timestamptz not null default now(),
  check (char_length(trim(body))>0 or attachment is not null),
  unique(thread_id,author,client_key)
);
create index journey_messages_thread on public.journey_messages(thread_id,id desc);
create index journey_messages_rate on public.journey_messages(author,created_at desc);
create table public.journey_quote_revisions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.journey_threads,
  revision int not null check (revision>0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_minor int not null check (unit_minor>=0),
  moq int not null check (moq between 1 and 1000000),
  tiers jsonb not null default '[]',
  shipping_minor int check (shipping_minor>=0),
  tax_minor int check (tax_minor>=0),
  duties_minor int check (duties_minor>=0),
  other_minor int check (other_minor>=0),
  production_days int not null check (production_days between 0 and 3650),
  transit_days int check (transit_days between 0 and 3650),
  delivery_supported boolean not null,
  method text not null check (method in ('shipping','pickup')),
  custom_terms text not null check (char_length(custom_terms)<=2000),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  unique(thread_id,revision)
);
alter table public.journey_threads
 add foreign key(latest_quote) references public.journey_quote_revisions,
 add foreign key(selected_quote) references public.journey_quote_revisions,
 add foreign key(confirmed_quote) references public.journey_quote_revisions;
create table public.journey_quote_drafts (
  thread_id uuid primary key references public.journey_threads,
  terms jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.journey_shortlists (
  thread_id uuid primary key references public.journey_threads,
  buyer_id uuid not null references auth.users
);
create table public.journey_orders (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null unique references public.journey_threads,
  quote_id uuid not null unique references public.journey_quote_revisions,
  buyer_id uuid not null references auth.users,
  business_id uuid not null references public.sourcing_businesses,
  terms jsonb not null,
  status text not null default 'confirmed' check (status in ('confirmed','preparing','dispatched','ready','completed','cancelled','disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.journey_events (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.journey_threads,
  actor uuid not null references auth.users,
  recipient_side text not null check (recipient_side in ('buyer','seller')),
  event_key text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  unique(thread_id,event_key)
);
create index journey_events_thread on public.journey_events(thread_id,id desc);
create table public.journey_reads (
  thread_id uuid not null references public.journey_threads,
  user_id uuid not null references auth.users,
  through_event bigint not null check (through_event>=0),
  primary key(thread_id,user_id)
);
create table public.journey_abuse (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.journey_threads,
  reporter uuid not null references auth.users,
  reason text not null check (char_length(trim(reason)) between 10 and 1000),
  created_at timestamptz not null default now(),
  unique(thread_id,reporter)
);

create function sourcing_private.journey_side(target uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when r.buyer_id=auth.uid() then 'buyer'
             when sourcing_private.can_catalogue(t.business_id) then 'seller' end
 from public.journey_threads t join public.journey_rfqs r on r.id=t.rfq_id where t.id=target;
$$;
create function sourcing_private.journey_rfq_access(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.journey_rfqs r where r.id=target and r.buyer_id=auth.uid())
   or exists(select 1 from public.journey_threads t where t.rfq_id=target and sourcing_private.can_catalogue(t.business_id));
$$;
create function sourcing_private.journey_file_allowed(object_name text, write_access boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.journey_threads t where t.id::text=split_part(object_name,'/',1)
 and sourcing_private.journey_side(t.id) is not null
 and (case when write_access then split_part(object_name,'/',2)=auth.uid()::text
       else split_part(object_name,'/',2)=auth.uid()::text or exists(select 1 from public.journey_messages m where m.thread_id=t.id and m.attachment=object_name) end));
$$;
revoke all on function sourcing_private.journey_side(uuid), sourcing_private.journey_rfq_access(uuid),
 sourcing_private.journey_file_allowed(text,boolean) from public,anon,authenticated;
grant execute on function sourcing_private.journey_side(uuid), sourcing_private.journey_rfq_access(uuid),
 sourcing_private.journey_file_allowed(text,boolean) to authenticated;
do $$
declare rel text;
begin
 foreach rel in array array['journey_rfqs','journey_threads','journey_messages','journey_quote_revisions','journey_quote_drafts','journey_shortlists','journey_orders','journey_events','journey_reads','journey_abuse'] loop
  execute format('alter table public.%I enable row level security',rel);
  execute format('revoke all on public.%I from public, anon, authenticated',rel);
  execute format('grant select on public.%I to authenticated',rel);
 end loop;
end $$;
create policy journey_rfq_read on public.journey_rfqs for select to authenticated using (sourcing_private.journey_rfq_access(id));
create policy journey_thread_read on public.journey_threads for select to authenticated using (sourcing_private.journey_side(id) is not null);
create policy journey_message_read on public.journey_messages for select to authenticated using (sourcing_private.journey_side(thread_id) is not null);
create policy journey_quote_read on public.journey_quote_revisions for select to authenticated using (sourcing_private.journey_side(thread_id) is not null);
create policy journey_draft_read on public.journey_quote_drafts for select to authenticated using (sourcing_private.journey_side(thread_id)='seller');
create policy journey_shortlist_read on public.journey_shortlists for select to authenticated using (buyer_id=(select auth.uid()));
create policy journey_order_read on public.journey_orders for select to authenticated using (sourcing_private.journey_side(thread_id) is not null);
create policy journey_event_read on public.journey_events for select to authenticated using (sourcing_private.journey_side(thread_id)=recipient_side);
create policy journey_receipt_read on public.journey_reads for select to authenticated using (user_id=(select auth.uid()) and sourcing_private.journey_side(thread_id) is not null);
create policy journey_abuse_read on public.journey_abuse for select to authenticated using (reporter=(select auth.uid()) or (select sourcing_private.is_operator()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('journey-private','journey-private',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy journey_private_upload on storage.objects for insert to authenticated
 with check(bucket_id='journey-private' and sourcing_private.journey_file_allowed(name,true));
create policy journey_private_download on storage.objects for select to authenticated
 using(bucket_id='journey-private' and sourcing_private.journey_file_allowed(name,false));
alter publication supabase_realtime add table public.journey_events;

alter table public.journey_threads add column stock_assignment uuid references public.stock_request_shops;
create unique index journey_stock_thread on public.journey_threads(stock_assignment) where stock_assignment is not null;

create function sourcing_private.journey_emit(thread_key uuid, actor_key uuid, recipient text, event_code text, event_kind text) returns void
language sql security invoker set search_path='' as $$
 insert into public.journey_events(thread_id,actor,recipient_side,event_key,kind)
 values(thread_key,actor_key,recipient,event_code,event_kind) on conflict do nothing;
$$;
revoke all on function sourcing_private.journey_emit(uuid,uuid,text,text,text) from public,anon,authenticated;

create function sourcing_private.journey_action(command text, payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 actor_id uuid := auth.uid();
 target_id uuid := nullif(payload->>'id','')::uuid;
 request_id uuid;
 business_id_arg uuid;
 request_key uuid;
 quote_key uuid;
 side_name text;
 recipient text;
 action_value text := payload->>'state';
 thread_row public.journey_threads;
 rfq_row public.journey_rfqs;
 quote_row public.journey_quote_revisions;
 order_row public.journey_orders;
 deadline_value date;
 unit_value int;
 next_revision int;
 file_path text:=nullif(payload->>'attachment','');
 stock_key uuid := nullif(payload->>'stockAssignment','')::uuid;
begin
 if actor_id is null or not exists(select 1 from auth.users where id=actor_id and email_confirmed_at is not null)
  then raise exception 'Verified account required' using errcode='42501'; end if;
 if command='submit_rfq' then
  request_key := (payload->>'submission')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text||request_key::text,0));
  select id into request_id from public.journey_rfqs where buyer_id=actor_id and submission=request_key;
  if found then return request_id; end if;
  if jsonb_typeof(payload->'businesses') is distinct from 'array'
    or jsonb_array_length(payload->'businesses') not between 1 and 5 then raise exception 'Choose one to five suppliers'; end if;
  deadline_value:=nullif(payload->>'deadline','')::date;
  if deadline_value < current_date then raise exception 'Choose a future deadline'; end if;
  if nullif(payload->>'product','') is not null and not exists(
    select 1 from public.sourcing_products p join public.sourcing_businesses b on b.id=p.owner_business_id
    where p.id=payload->>'product' and p.publication_state='published' and b.published and b.trust_state='verified')
    then raise exception 'Product is not available'; end if;
  insert into public.journey_rfqs(buyer_id,submission,title,specifications,product_id,variant_id,quantity,unit,destination,deadline,budget_minor,currency,custom)
    values(actor_id,request_key,trim(payload->>'title'),coalesce(payload->>'specifications',''),nullif(payload->>'product',''),
    nullif(payload->>'variant',''),(payload->>'quantity')::int,payload->>'unit',trim(payload->>'destination'),
    deadline_value,(payload->>'budget')::bigint,upper(payload->>'currency'),coalesce((payload->>'custom')::boolean,false))
    returning id into request_id;
  for business_id_arg in select distinct value::uuid from jsonb_array_elements_text(payload->'businesses') loop
    if not exists(select 1 from public.sourcing_businesses b where b.id=business_id_arg and b.published and b.trust_state='verified')
      then raise exception 'Supplier is not accepting live enquiries'; end if;
    if stock_key is not null and (jsonb_array_length(payload->'businesses')<>1 or not exists(
      select 1 from public.stock_request_shops a join public.stock_requests r on r.id=a.request_id
      join public.sourcing_businesses b on b.pilot_business_id=a.business_id
      where a.id=stock_key and r.buyer_id=actor_id and b.id=business_id_arg))
      then raise exception 'Stock enquiry does not belong to this buyer and supplier' using errcode='42501'; end if;
    insert into public.journey_threads(rfq_id,business_id,stock_assignment)
      values(request_id,business_id_arg,stock_key) returning id into target_id;
    perform sourcing_private.journey_emit(target_id,actor_id,'seller','rfq','RFQ received');
  end loop;
  return request_id;
 end if;

 select * into thread_row from public.journey_threads where id=target_id for update;
 side_name:=sourcing_private.journey_side(target_id);
 if side_name is null then raise exception 'Conversation participant required' using errcode='42501'; end if;
 select * into rfq_row from public.journey_rfqs where id=thread_row.rfq_id;
 recipient:=case when side_name='buyer' then 'seller' else 'buyer' end;
 if command in ('message','clarify') then
   request_key:=(payload->>'requestKey')::uuid;
   if exists(select 1 from public.journey_messages m where m.thread_id=target_id and m.author=actor_id and m.client_key=request_key)
     then return target_id; end if;
   perform pg_advisory_xact_lock(hashtextextended(actor_id::text,2));
   if (select count(*) from public.journey_messages m where m.author=actor_id and m.created_at>clock_timestamp()-interval '1 minute')>=20 then
     raise exception 'Message limit reached. Try again in a minute.';
   end if;
   if file_path is not null and (split_part(file_path,'/',1)<>target_id::text or split_part(file_path,'/',2)<>actor_id::text
       or not exists(select 1 from storage.objects where bucket_id='journey-private' and name=file_path)) then
     raise exception 'Attachment is unavailable' using errcode='42501';
   end if;
   insert into public.journey_messages(thread_id,author,side,client_key,body,attachment)
     values(target_id,actor_id,side_name,request_key,coalesce(trim(payload->>'body'),''),file_path);
   if command='clarify' and thread_row.quote_state in ('submitted','revised') then
     update public.journey_threads set quote_state='under_discussion' where id=target_id;
   end if;
   perform sourcing_private.journey_emit(target_id,actor_id,recipient,'message:'||request_key,
     case when command='clarify' then 'Clarification requested' else 'New message' end);
 elsif command='read' then
   insert into public.journey_reads(thread_id,user_id,through_event)
     select target_id,actor_id,coalesce(max(id),0) from public.journey_events
       where thread_id=target_id and recipient_side=side_name and id<=coalesce((payload->>'through')::bigint,0)
     on conflict(thread_id,user_id) do update set through_event=greatest(public.journey_reads.through_event,excluded.through_event);
   return target_id;
 elsif command='report' then
   insert into public.journey_abuse(thread_id,reporter,reason) values(target_id,actor_id,trim(payload->>'reason')) on conflict do nothing;
   return target_id;
 elsif command='invite_reply' then
   if side_name<>'seller' or thread_row.invite_state<>'invited' or action_value is null or action_value not in ('accepted','declined') then
     raise exception 'Invitation response unavailable' using errcode='42501';
   end if;
   update public.journey_threads set invite_state=action_value where id=target_id;
   perform sourcing_private.journey_emit(target_id,actor_id,recipient,'invitation:'||action_value,'Invitation '||action_value);
 elsif command in ('save_quote','submit_quote') then
   if side_name<>'seller' or thread_row.invite_state<>'accepted' or exists(select 1 from public.journey_orders where thread_id=target_id)
     then raise exception 'Supplier with accepted invitation required' using errcode='42501'; end if;
   if command='save_quote' then
     if octet_length(payload::text)>16000 then raise exception 'Quote draft too large'; end if;
     insert into public.journey_quote_drafts(thread_id,terms) values(target_id,payload)
       on conflict(thread_id) do update set terms=excluded.terms,updated_at=now();
     return target_id;
   end if;
   if (payload->>'expires')::timestamptz <= clock_timestamp() then raise exception 'Quote must expire in the future'; end if;
   if jsonb_typeof(coalesce(payload->'tiers','[]'))<>'array' or jsonb_array_length(coalesce(payload->'tiers','[]'))>20
     then raise exception 'Use up to twenty price tiers'; end if;
   if exists(select 1 from jsonb_to_recordset(coalesce(payload->'tiers','[]')) as t(quantity int,minor int)
     where quantity is null or minor is null or quantity<(payload->>'moq')::int or quantity>1000000 or minor<0)
     then raise exception 'Invalid tier'; end if;
   if exists(select 1 from jsonb_to_recordset(coalesce(payload->'tiers','[]')) as t(quantity int,minor int) group by quantity having count(*)>1)
     then raise exception 'Price tier quantities must be unique'; end if;
   select coalesce(max(revision),0)+1 into next_revision from public.journey_quote_revisions where thread_id=target_id;
   insert into public.journey_quote_revisions(thread_id,revision,currency,unit_minor,moq,tiers,shipping_minor,tax_minor,duties_minor,other_minor,
      production_days,transit_days,delivery_supported,method,custom_terms,expires_at,created_by)
     values(target_id,next_revision,upper(payload->>'currency'),(payload->>'unitMinor')::int,(payload->>'moq')::int,
      coalesce(payload->'tiers','[]'),(payload->>'shipping')::int,(payload->>'tax')::int,(payload->>'duties')::int,(payload->>'other')::int,
      (payload->>'production')::int,(payload->>'transit')::int,coalesce((payload->>'supported')::boolean,false),payload->>'method',
      coalesce(payload->>'customTerms',''),(payload->>'expires')::timestamptz,actor_id) returning id into quote_key;
   update public.journey_threads set latest_quote=quote_key,selected_quote=null,confirmed_quote=null,
     quote_state=case when next_revision=1 then 'submitted' else 'revised' end where id=target_id;
   delete from public.journey_quote_drafts where thread_id=target_id;
   perform sourcing_private.journey_emit(target_id,actor_id,recipient,'quote:'||quote_key,
     case when next_revision=1 then 'Quote submitted' else 'Quote revised' end);
 elsif command in ('select_quote','confirm_terms','create_order','withdraw_quote','decline_quote','shortlist') then
   if command='shortlist' then
     if side_name<>'buyer' then raise exception 'Buyer permission required' using errcode='42501'; end if;
     if action_value='remove' then delete from public.journey_shortlists where thread_id=target_id and buyer_id=actor_id;
     else insert into public.journey_shortlists(thread_id,buyer_id) values(target_id,actor_id) on conflict do nothing; end if;
     return target_id;
   end if;
   quote_key:=(payload->>'quote')::uuid;
   if command='create_order' and side_name='buyer' then
     select id into request_id from public.journey_orders where thread_id=target_id and quote_id=quote_key;
     if found then return request_id; end if;
   end if;
   if quote_key is null or thread_row.latest_quote is distinct from quote_key
     or exists(select 1 from public.journey_orders where thread_id=target_id)
     then raise exception 'Current unconverted quote revision required'; end if;
   select * into quote_row from public.journey_quote_revisions where id=quote_key;
   if command<>'withdraw_quote' and quote_row.expires_at<=clock_timestamp() then raise exception 'Quotation expired'; end if;
   if command='select_quote' and side_name='buyer' and thread_row.quote_state in ('submitted','revised','under_discussion') then
     update public.journey_threads set selected_quote=quote_key,confirmed_quote=null,quote_state='selected' where id=target_id;
     perform sourcing_private.journey_emit(target_id,actor_id,recipient,'selected:'||quote_key,'Quote selected');
   elsif command='confirm_terms' and side_name='seller' and thread_row.quote_state='selected' and thread_row.selected_quote=quote_key then
     if rfq_row.quantity<quote_row.moq or not quote_row.delivery_supported or
       quote_row.shipping_minor is null or quote_row.tax_minor is null or quote_row.duties_minor is null or quote_row.other_minor is null
       or (quote_row.method='shipping' and quote_row.transit_days is null)
       or (rfq_row.custom and char_length(trim(quote_row.custom_terms))=0)
       or (rfq_row.deadline is not null and current_date+quote_row.production_days+coalesce(quote_row.transit_days,0)>rfq_row.deadline)
       then raise exception 'Revise incomplete or unsuitable terms before confirming'; end if;
     update public.journey_threads set confirmed_quote=quote_key,quote_state='confirmed' where id=target_id;
     perform sourcing_private.journey_emit(target_id,actor_id,recipient,'terms:'||quote_key,'Supplier confirmed terms');
   elsif command='create_order' and side_name='buyer' and thread_row.quote_state='confirmed' and thread_row.confirmed_quote=quote_key then
     perform pg_advisory_xact_lock(hashtextextended(rfq_row.id::text,1));
     if exists(select 1 from public.journey_orders o join public.journey_threads t on t.id=o.thread_id where t.rfq_id=rfq_row.id)
       then raise exception 'An order already exists for this requirement'; end if;
     select t.minor into unit_value from jsonb_to_recordset(quote_row.tiers) as t(quantity int,minor int)
       where t.quantity<=rfq_row.quantity order by t.quantity desc limit 1;
     unit_value:=coalesce(unit_value,quote_row.unit_minor);
     insert into public.journey_orders(thread_id,quote_id,buyer_id,business_id,terms)
       values(target_id,quote_key,actor_id,thread_row.business_id,jsonb_build_object(
         'requirement',to_jsonb(rfq_row)-'submission','quote',to_jsonb(quote_row),'appliedUnitMinor',unit_value,
         'estimatedDate',current_date+quote_row.production_days+coalesce(quote_row.transit_days,0),
         'totalMinor',unit_value::bigint*rfq_row.quantity+quote_row.shipping_minor+quote_row.tax_minor+quote_row.duties_minor+quote_row.other_minor))
       returning id into request_id;
     perform sourcing_private.journey_emit(target_id,actor_id,recipient,'order:'||request_id,'Order confirmed');
     return request_id;
   elsif command='withdraw_quote' and side_name='seller' and thread_row.quote_state not in ('withdrawn','declined') then
     update public.journey_threads set selected_quote=null,confirmed_quote=null,quote_state='withdrawn' where id=target_id;
     perform sourcing_private.journey_emit(target_id,actor_id,recipient,'withdrawn:'||quote_key,'Quote withdrawn');
   elsif command='decline_quote' and side_name='buyer' and thread_row.quote_state in ('submitted','revised','under_discussion','selected') then
     update public.journey_threads set selected_quote=null,confirmed_quote=null,quote_state='declined' where id=target_id;
     perform sourcing_private.journey_emit(target_id,actor_id,recipient,'declined:'||quote_key,'Quote declined');
   else raise exception 'Quote transition is unavailable' using errcode='42501'; end if;
 elsif command='fulfil' then
   select * into order_row from public.journey_orders where thread_id=target_id for update;
   if not found then raise exception 'Order unavailable'; end if;
   if (side_name='seller' and ((order_row.status='confirmed' and action_value='preparing')
       or (order_row.status='preparing' and ((order_row.terms#>>'{quote,method}'='shipping' and action_value='dispatched')
          or (order_row.terms#>>'{quote,method}'='pickup' and action_value='ready')))
       or (order_row.status in ('dispatched','ready') and action_value='completed')))
      or (order_row.status='confirmed' and action_value='cancelled')
      or (side_name='buyer' and order_row.status in ('preparing','dispatched','ready','completed') and action_value='disputed') then
      update public.journey_orders set status=action_value,updated_at=now() where id=order_row.id;
      perform sourcing_private.journey_emit(target_id,actor_id,recipient,'order:'||order_row.id||':'||action_value,'Order status: '||action_value);
   else raise exception 'Order transition is unavailable' using errcode='42501'; end if;
 else raise exception 'Unknown journey action';
 end if;
 update public.journey_threads set updated_at=clock_timestamp() where id=target_id;
 return target_id;
end;
$$;

create function public.journey_action(command text,payload jsonb) returns uuid
language sql security invoker set search_path='' as $$ select sourcing_private.journey_action(command,payload); $$;
revoke all on function public.journey_action(text,jsonb),sourcing_private.journey_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.journey_action(text,jsonb),sourcing_private.journey_action(text,jsonb) to authenticated;
