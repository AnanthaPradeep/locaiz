
-- Extend the existing sourcing catalogue. Stock-pilot relations are untouched.
alter table sourcing_private.members add column member_role text not null default 'owner'
  check (member_role in ('owner','manager','catalogue'));
alter table public.sourcing_businesses
  add column trust_state text not null default 'unverified'
    check (trust_state in ('unverified','pending','verified','restricted')),
  add column capabilities text[] not null default '{}';
alter table public.sourcing_products
  add column owner_business_id uuid references public.sourcing_businesses,
  add column description text not null default '',
  add column publication_state text not null default 'draft'
    check (publication_state in ('draft','submitted','under_review','published','rejected','archived'));
create index sourcing_products_owner on public.sourcing_products(owner_business_id, publication_state);
create index sourcing_offers_business on public.sourcing_offers(business_id);

create table public.market_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80)
);
create table public.market_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.sourcing_businesses on delete cascade,
  locality text not null check (char_length(trim(locality)) between 1 and 120),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  pickup boolean not null default false
);
create index market_locations_parent on public.market_locations(business_id);
create table public.market_inventory (
  product_id text not null, variant_id text not null,
  quantity integer not null check (quantity between 0 and 1000000),
  updated_at timestamptz not null default now(),
  primary key(product_id, variant_id),
  foreign key(product_id, variant_id) references public.sourcing_variants on delete cascade
);
create table public.market_media (
  object_name text primary key,
  product_id text not null references public.sourcing_products on delete cascade,
  alt_text text not null check (char_length(alt_text) <= 160)
);
create index market_media_product on public.market_media(product_id);
create table sourcing_private.operators (
  user_id uuid primary key references auth.users on delete cascade
);
create table public.market_verifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.sourcing_businesses,
  submitted_by uuid not null references auth.users,
  evidence_path text,
  summary text not null check (char_length(trim(summary)) between 1 and 2000),
  state text not null default 'pending' check (state in ('pending','verified','rejected','restricted')),
  notes text,
  created_at timestamptz not null default now()
);
create unique index market_verifications_pending on public.market_verifications(business_id) where state = 'pending';
create table public.market_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.sourcing_businesses,
  reporter uuid not null references auth.users,
  complaint text not null check (char_length(trim(complaint)) between 10 and 2000),
  state text not null default 'open' check (state in ('open','resolved','dismissed')),
  notes text,
  created_at timestamptz not null default now()
);
create index market_reports_reporter on public.market_reports(reporter, created_at desc);
create table public.market_audit (
  id bigint generated always as identity primary key,
  actor uuid not null references auth.users,
  business_id uuid not null references public.sourcing_businesses,
  target text not null, action text not null, notes text, snapshot jsonb,
  created_at timestamptz not null default now()
);
create index market_audit_business on public.market_audit(business_id, created_at desc);
create table public.market_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.sourcing_businesses,
  email text not null check (char_length(email) between 3 and 254 and position('@' in email)>1),
  role text not null check (role in ('manager','catalogue')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);
create index market_invite_business on public.market_invites(business_id);

create function sourcing_private.market_role(target uuid) returns text
language sql stable security definer set search_path = '' as $$
  select member_role from sourcing_private.members where business_id = target and user_id = auth.uid();
$$;
create function sourcing_private.is_operator() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from sourcing_private.operators where user_id = auth.uid());
$$;
create function sourcing_private.can_catalogue(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(sourcing_private.market_role(target) in ('owner','manager','catalogue'), false);
$$;
create function sourcing_private.can_manage(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(sourcing_private.market_role(target) in ('owner','manager'), false);
$$;
create function sourcing_private.product_media_allowed(object_name text, write_access boolean) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
   select 1 from public.sourcing_products p join public.sourcing_businesses b on b.id=p.owner_business_id
   where p.id=split_part(object_name,'/',2) and b.id::text=split_part(object_name,'/',1)
   and case when write_access then sourcing_private.can_catalogue(b.id) and p.publication_current_listing_state in ('draft','rejected')
        else sourcing_private.can_catalogue(b.id) or sourcing_private.is_operator()
          or (p.publication_state='published' and b.published and b.trust_state <> 'restricted'
              and exists(select 1 from public.market_media m where m.object_name=product_media_allowed.object_name and m.product_id=p.id)) end
 );
$$;
create function sourcing_private.evidence_allowed(object_name text, write_access boolean) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.sourcing_businesses b where b.id::text=split_part(object_name,'/',1)
   and (sourcing_private.can_manage(b.id) or (not write_access and sourcing_private.is_operator())));
$$;
revoke all on function sourcing_private.market_role(uuid), sourcing_private.is_operator(),
 sourcing_private.can_catalogue(uuid), sourcing_private.can_manage(uuid),
 sourcing_private.product_media_allowed(text,boolean), sourcing_private.evidence_allowed(text,boolean)
 from public, anon, authenticated;
grant execute on function sourcing_private.market_role(uuid), sourcing_private.is_operator(),
 sourcing_private.can_catalogue(uuid), sourcing_private.can_manage(uuid),
 sourcing_private.product_media_allowed(text,boolean), sourcing_private.evidence_allowed(text,boolean)
 to authenticated;
grant execute on function sourcing_private.product_media_allowed(text,boolean) to anon;
grant usage on schema sourcing_private to anon;

alter table public.market_profiles enable row level security;
alter table public.market_locations enable row level security;
alter table public.market_inventory enable row level security;
alter table public.market_media enable row level security;
alter table sourcing_private.operators enable row level security;
alter table public.market_verifications enable row level security;
alter table public.market_reports enable row level security;
alter table public.market_audit enable row level security;
alter table public.market_invites enable row level security;

revoke all on public.market_profiles, public.market_locations, public.market_inventory, public.market_media,
 public.market_verifications, public.market_reports, public.market_audit, public.market_invites,
 sourcing_private.operators from public, anon, authenticated;
grant select, insert, update on public.market_profiles to authenticated;
grant select on public.market_locations, public.market_media to anon, authenticated;
grant select on public.market_inventory, public.market_verifications, public.market_reports,
 public.market_audit, public.market_invites to authenticated;
create policy market_own_profile on public.market_profiles for all to authenticated
 using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy market_read_locations on public.market_locations for select to anon, authenticated
 using (exists(select 1 from public.sourcing_businesses b where b.id=business_id));
create policy market_read_media on public.market_media for select to anon, authenticated
 using (sourcing_private.product_media_allowed(object_name,false));
create policy market_read_inventory on public.market_inventory for select to authenticated
 using (exists(select 1 from public.sourcing_products p where p.id=product_id and sourcing_private.can_catalogue(p.owner_business_id)));
create policy market_read_verifications on public.market_verifications for select to authenticated
 using ((select sourcing_private.is_operator()) or sourcing_private.can_manage(business_id));
create policy market_read_reports on public.market_reports for select to authenticated
 using ((select sourcing_private.is_operator()) or reporter=(select auth.uid()));
create policy market_read_audit on public.market_audit for select to authenticated
 using ((select sourcing_private.is_operator()));
create policy market_read_invites on public.market_invites for select to authenticated
 using (sourcing_private.market_role(business_id)='owner');

drop policy sourcing_product_read on public.sourcing_products;
drop policy sourcing_variant_read on public.sourcing_variants;
create policy market_public_products on public.sourcing_products for select to anon, authenticated
 using (owner_business_id is null or (publication_state='published' and exists (
  select 1 from public.sourcing_businesses b where b.id=owner_business_id and b.published and b.trust_state <> 'restricted')));
create policy market_member_products on public.sourcing_products for select to authenticated
 using (sourcing_private.can_catalogue(owner_business_id) or (select sourcing_private.is_operator()));
create policy market_visible_variants on public.sourcing_variants for select to anon, authenticated
 using (exists(select 1 from public.sourcing_products p where p.id=product_id));
create policy market_operator_business on public.sourcing_businesses for select to authenticated
 using ((select sourcing_private.is_operator()));
create policy market_operator_offer on public.sourcing_offers for select to authenticated
 using ((select sourcing_private.is_operator()));
drop policy sourcing_public_business on public.sourcing_businesses;
create policy sourcing_public_business on public.sourcing_businesses for select to anon, authenticated
 using (published and trust_state <> 'restricted');
drop policy sourcing_public_offer on public.sourcing_offers;
create policy sourcing_public_offer on public.sourcing_offers for select to anon, authenticated
 using (published and (expires_at is null or expires_at > now())
   and exists(select 1 from public.sourcing_businesses b where b.id=business_id and b.published and b.trust_state <> 'restricted')
   and exists(select 1 from public.sourcing_products p where p.id=product_id and
       (p.owner_business_id is null or (p.owner_business_id=business_id and p.publication_state='published'))));
-- Existing draft policy remains for legacy products; owned listings go through the workflow RPC.
drop policy sourcing_offer_create on public.sourcing_offers;
drop policy sourcing_offer_edit on public.sourcing_offers;
create policy sourcing_offer_create on public.sourcing_offers for insert to authenticated
 with check (not published and sourcing_private.can_catalogue(business_id) and
   exists(select 1 from public.sourcing_products p where p.id=product_id and p.owner_business_id is null));
create policy sourcing_offer_edit on public.sourcing_offers for update to authenticated
 using (not published and sourcing_private.can_catalogue(business_id) and
   exists(select 1 from public.sourcing_products p where p.id=product_id and p.owner_business_id is null))
 with check (not published and sourcing_private.can_catalogue(business_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('market-images','market-images',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('market-evidence','market-evidence',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy market_image_upload on storage.objects for insert to authenticated
 with check (bucket_id='market-images' and sourcing_private.product_media_allowed(name,true));
create policy market_image_read on storage.objects for select to anon, authenticated
 using (bucket_id='market-images' and sourcing_private.product_media_allowed(name,false));
create policy market_evidence_upload on storage.objects for insert to authenticated
 with check (bucket_id='market-evidence' and sourcing_private.evidence_allowed(name,true));
create policy market_evidence_read on storage.objects for select to authenticated
 using (bucket_id='market-evidence' and sourcing_private.evidence_allowed(name,false));

insert into public.sourcing_categories(id,name) values
 ('market-electronics','Electronics & Audio'), ('market-accessories','Computer & Mobile Accessories'),
 ('market-fashion','Fashion & Apparel'), ('market-bags','Bags & Accessories'),
 ('market-home','Home Decor & Furniture'), ('market-kitchen','Kitchen & Dining'),
 ('market-beauty','Beauty & Wellness'), ('market-sports','Sports & Outdoors'),
 ('market-handmade','Handmade & Regional'), ('market-tools','Tools & Industrial')
on conflict (id) do nothing;

create function sourcing_private.market_context() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
   'operator', sourcing_private.is_operator(),
   'businesses', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'role',m.member_role,'trust',b.trust_state,'description',b.description,'capabilities',b.capabilities,'type',b.roles[1]) order by b.name)
     from public.sourcing_businesses b join sourcing_private.members m on m.business_id=b.id where m.user_id=auth.uid()), '[]'::jsonb)
 );
$$;

create function sourcing_private.market_action(action_name text, payload jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  business uuid := nullif(payload->>'business','')::uuid;
  target text := nullif(payload->>'target','');
  sku text := trim(coalesce(payload->>'sku',''));
  verb text := payload->>'decision';
  memo text := left(nullif(trim(payload->>'notes'),''),2000);
  place text;
  offer uuid;
  current_listing_state text;
  entry public.market_invites;
begin
  if actor is null then raise exception 'Sign in is required' using errcode='42501'; end if;
  if action_name = 'create_business' then
    if char_length(trim(coalesce(payload->>'name',''))) not between 2 and 120 or char_length(trim(coalesce(payload->>'city',''))) not between 2 and 120 then
      raise exception 'Provide a business name and locality';
    end if;
    place := 'market-' || gen_random_uuid();
    insert into public.sourcing_places(id,name,kind,country_code)
      values(place,trim(payload->>'city'),'Locality',upper(payload->>'country'));
    insert into public.sourcing_businesses(name,description,base_id,roles,capabilities)
      values(trim(payload->>'name'),left(coalesce(payload->>'description',''),2000),place,
        array[payload->>'type'], array(select jsonb_array_elements_text(coalesce(payload->'capabilities','[]'))))
      returning id into business;
    insert into sourcing_private.members(business_id,user_id,member_role) values(business,actor,'owner');
    insert into public.market_locations(business_id,locality,country_code,pickup)
      values(business,trim(payload->>'city'),upper(payload->>'country'),coalesce((payload->>'pickup')::boolean,false));
    target := business::text;
  elsif action_name = 'add_location' then
    if not sourcing_private.can_manage(business) then raise exception 'Business manager required' using errcode='42501'; end if;
    insert into public.market_locations(business_id,locality,country_code,pickup)
      values(business,trim(payload->>'city'),upper(payload->>'country'),coalesce((payload->>'pickup')::boolean,false))
      returning id::text into target;
  elsif action_name = 'invite' then
    if sourcing_private.market_role(business) is distinct from 'owner' then raise exception 'Business owner required' using errcode='42501'; end if;
    insert into public.market_invites(business_id,email,role)
      values(business,lower(trim(payload->>'email')),payload->>'role') returning id::text into target;
  elsif action_name = 'accept_invite' then
    select * into entry from public.market_invites where id=target::uuid and accepted_at is null and expires_at>now() for update;
    if not found or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and lower(email)=entry.email) then
      raise exception 'Invitation is unavailable for this account' using errcode='42501';
    end if;
    business := entry.business_id;
    insert into sourcing_private.members(business_id,user_id,member_role) values(business,actor,entry.role) on conflict do nothing;
    update public.market_invites set accepted_at=now() where id=entry.id;
  elsif action_name in ('save_listing','inventory','attach_media','listing_state') then
    if not sourcing_private.can_catalogue(business) then raise exception 'Business catalogue permission required' using errcode='42501'; end if;
    if target is not null then
      select publication_state into current_listing_state from public.sourcing_products where id=target and owner_business_id=business for update;
      if not found then raise exception 'Listing is unavailable for this business' using errcode='42501'; end if;
    elsif action_name <> 'save_listing' then
      raise exception 'Listing required';
    end if;
    if action_name='save_listing' then
      if target is not null and current_listing_state not in ('draft','rejected') then raise exception 'Only drafts or rejected listings can be edited'; end if;
      if char_length(trim(coalesce(payload->>'name',''))) not between 2 and 120 or sku !~ '^[A-Za-z0-9_-]{1,80}$' then
        raise exception 'Provide a product name and a valid SKU';
      end if;
      if target is null then
        target := 'market-' || gen_random_uuid();
        insert into public.sourcing_products(id,name,description,category_id,origin_id,manufacturer_id,owner_business_id)
          select target,trim(payload->>'name'),left(coalesce(payload->>'description',''),3000),payload->>'category',b.base_id,b.id,b.id
          from public.sourcing_businesses b where b.id=business;
      else
        update public.sourcing_products set name=trim(payload->>'name'), description=left(coalesce(payload->>'description',''),3000),
          category_id=payload->>'category', publication_state='draft' where id=target;
      end if;
      insert into public.sourcing_variants(product_id,id,name)
        values(target,sku,left(coalesce(nullif(trim(payload->>'variant'),''),sku),120))
        on conflict(product_id,id) do update set name=excluded.name;
      if exists(select 1 from public.sourcing_offers where product_id=target and variant_id=sku and business_id=business and method<>payload->>'method') then
        delete from public.sourcing_offers where product_id=target and variant_id=sku and business_id=business and not published;
      end if;
      insert into public.sourcing_offers(product_id,variant_id,business_id,method,currency,unit_price_minor,minimum_quantity,
        pickup_id,shipping_origin_id,shipping_countries,lead_days,custom_order)
      select target,sku,business,payload->>'method',upper(payload->>'currency'),(payload->>'price')::integer,
        (payload->>'moq')::integer,case when coalesce((payload->>'pickup')::boolean,false) then b.base_id end,b.base_id,
        array(select upper(value) from jsonb_array_elements_text(coalesce(payload->'countries','[]')) where value ~ '^[A-Za-z]{2}$'),
        (payload->>'lead')::integer,coalesce((payload->>'custom')::boolean,false)
      from public.sourcing_businesses b where b.id=business
      on conflict(business_id,product_id,variant_id,method) do update set
        currency=excluded.currency, unit_price_minor=excluded.unit_price_minor, minimum_quantity=excluded.minimum_quantity,
        pickup_id=excluded.pickup_id, shipping_countries=excluded.shipping_countries, lead_days=excluded.lead_days, custom_order=excluded.custom_order
      returning id into offer;
      delete from public.sourcing_price_tiers where offer_id=offer;
      if exists(select 1 from jsonb_to_recordset(coalesce(payload->'tiers','[]')) as t(quantity integer,minor integer)
        where t.quantity < (payload->>'moq')::integer) then raise exception 'Price tier below MOQ'; end if;
      insert into public.sourcing_price_tiers(offer_id,quantity,unit_price_minor)
        select offer,t.quantity,t.minor from jsonb_to_recordset(coalesce(payload->'tiers','[]')) as t(quantity integer,minor integer);
      insert into public.market_inventory(product_id,variant_id,quantity) values(target,sku,(payload->>'quantity')::integer)
        on conflict(product_id,variant_id) do update set quantity=excluded.quantity,updated_at=now();
    elsif action_name='inventory' then
      update public.market_inventory set quantity=(payload->>'quantity')::integer,updated_at=now()
        where product_id=target and variant_id=sku;
      if not found then raise exception 'SKU does not exist'; end if;
    elsif action_name='attach_media' then
      if current_listing_state not in ('draft','rejected') or split_part(payload->>'path','/',1)<>business::text or
        split_part(payload->>'path','/',2)<>target or not exists(
          select 1 from storage.objects where bucket_id='market-images' and name=payload->>'path') then
        raise exception 'Upload the image to the current draft first';
      end if;
      insert into public.market_media(object_name,product_id,alt_text)
        values(payload->>'path',target,left(coalesce(payload->>'alt',''),160));
    else
      if (verb='submitted' and current_listing_state in ('draft','rejected') and exists(select 1 from public.sourcing_offers where product_id=target))
         or (verb='archived' and current_listing_state <> 'archived') then
        update public.sourcing_products set publication_state=verb where id=target;
        if verb='archived' then update public.sourcing_offers set published=false where product_id=target; end if;
      else raise exception 'This listing transition is unavailable'; end if;
    end if;
  elsif action_name='verify_request' then
    if not sourcing_private.can_manage(business) then raise exception 'Business manager required' using errcode='42501'; end if;
    if exists(select 1 from public.sourcing_businesses where id=business and trust_state='restricted') then raise exception 'Restricted businesses require operator review'; end if;
    if nullif(payload->>'path','') is not null and (split_part(payload->>'path','/',1)<>business::text
      or not exists(select 1 from storage.objects where bucket_id='market-evidence' and name=payload->>'path')) then
      raise exception 'Invalid evidence path';
    end if;
    insert into public.market_verifications(business_id,submitted_by,evidence_path,summary)
      values(business,actor,nullif(payload->>'path',''),trim(payload->>'summary')) returning id::text into target;
    update public.sourcing_businesses set trust_state='pending', verification='unverified', published=false where id=business;
  elsif action_name='report' then
    if not exists(select 1 from public.sourcing_businesses where id=business and published and trust_state <> 'restricted') then raise exception 'Public supplier unavailable'; end if;
    insert into public.market_reports(business_id,reporter,complaint) values(business,actor,trim(payload->>'complaint')) returning id::text into target;
  elsif action_name in ('review_listing','review_supplier','review_report') then
    if not sourcing_private.is_operator() then raise exception 'Trust operator permission required' using errcode='42501'; end if;
    if action_name='review_listing' then
      select owner_business_id, publication_state into business,current_listing_state from public.sourcing_products where id=target and owner_business_id is not null for update;
      if not found or current_listing_state not in ('submitted','under_review') or verb not in ('under_review','published','rejected') or verb is null then
        raise exception 'Invalid moderation transition';
      end if;
      if verb='published' and not exists(select 1 from public.sourcing_businesses where id=business and trust_state='verified' and published)
        then raise exception 'Supplier must pass verification first'; end if;
      update public.sourcing_products set publication_state=verb where id=target;
      update public.sourcing_offers set published=(verb='published') where product_id=target and business_id=business;
    elsif action_name='review_supplier' then
      if verb not in ('verified','rejected','restricted') or verb is null then raise exception 'Invalid verification decision'; end if;
      update public.market_verifications set state=verb,notes=memo where id=target::uuid
        and (state='pending' or (state='verified' and verb='restricted')) returning business_id into business;
      if not found then raise exception 'Verification unavailable'; end if;
      update public.sourcing_businesses set trust_state=case when verb='rejected' then 'unverified' else verb end,
        verification=case when verb='verified' then 'identity_reviewed' else 'unverified' end, published=(verb='verified')
        where id=business;
    else
      if verb not in ('resolved','dismissed') or verb is null then raise exception 'Invalid report decision'; end if;
      update public.market_reports set state=verb,notes=memo where id=target::uuid and state='open' returning business_id into business;
      if not found then raise exception 'Report unavailable'; end if;
    end if;
  else raise exception 'Unknown marketplace action';
  end if;
  insert into public.market_audit(actor,business_id,target,action,notes,snapshot)
    values(actor,business,target,action_name || coalesce(':'||verb,''),memo,
      case when action_name='save_listing' then payload - 'notes' end);
  return target;
end;
$$;

create function public.market_context() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select sourcing_private.market_context();
$$;
create function public.market_action(action_name text,payload jsonb) returns text
language sql security invoker set search_path = '' as $$
 select sourcing_private.market_action(action_name,payload);
$$;
revoke all on function public.market_context(),public.market_action(text,jsonb),
 sourcing_private.market_context(),sourcing_private.market_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.market_context(),public.market_action(text,jsonb),
 sourcing_private.market_context(),sourcing_private.market_action(text,jsonb) to authenticated;

drop policy sourcing_place_read on public.sourcing_places;
create policy sourcing_place_read on public.sourcing_places for select to anon, authenticated
 using (id not like 'market-%' or exists(select 1 from public.sourcing_businesses b where b.base_id=sourcing_places.id));
