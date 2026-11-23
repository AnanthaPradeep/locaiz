-- Additive schema for a future connected directory. Phase 2 remains independent.
create schema sourcing_private;
revoke all on schema sourcing_private from public, anon, authenticated;
grant usage on schema sourcing_private to authenticated;

create table public.sourcing_places (
  id text primary key,
  parent_id text references public.sourcing_places,
  name text not null,
  kind text not null,
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  check (parent_id is distinct from id),
  check ((latitude is null) = (longitude is null))
);
create index sourcing_places_parent on public.sourcing_places(parent_id);
create index sourcing_places_search on public.sourcing_places using gin(to_tsvector('simple', name));

create table public.sourcing_categories (
  id text primary key,
  parent_id text references public.sourcing_categories,
  name text not null,
  attributes jsonb not null default '{}',
  check (parent_id is distinct from id)
);
create index sourcing_categories_parent on public.sourcing_categories(parent_id);

create table public.sourcing_businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  base_id text not null references public.sourcing_places,
  production_id text references public.sourcing_places,
  pilot_business_id uuid unique references public.stock_businesses on delete set null,
  roles text[] not null check (
    cardinality(roles) > 0 and roles <@ array['Artisan','Home-based producer','Cottage industry','Workshop',
      'Small manufacturer','Medium manufacturer','Large manufacturer','Wholesaler','Distributor','Retailer','Exporter','Service provider']
    and array_position(roles, null) is null
  ),
  verification text not null default 'unverified'
    check (verification in ('unverified','identity_reviewed','documents_reviewed','factory_reviewed')),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index sourcing_businesses_base on public.sourcing_businesses(base_id);
create index sourcing_businesses_production on public.sourcing_businesses(production_id);
create index sourcing_businesses_roles on public.sourcing_businesses using gin(roles) where published;
create table sourcing_private.members (
  business_id uuid references public.sourcing_businesses on delete cascade,
  user_id uuid references auth.users on delete cascade,
  primary key(business_id, user_id)
);
create index sourcing_members_user on sourcing_private.members(user_id, business_id);
alter table sourcing_private.members enable row level security;
revoke all on sourcing_private.members from public, anon, authenticated;

create table public.sourcing_products (
  id text primary key,
  name text not null,
  category_id text not null references public.sourcing_categories,
  origin_id text references public.sourcing_places,
  manufacturer_id uuid references public.sourcing_businesses,
  provenance text not null default 'reported' check (provenance in ('reported','reviewed','independently_verified')),
  created_at timestamptz not null default now()
);
create index sourcing_products_category on public.sourcing_products(category_id);
create index sourcing_products_origin on public.sourcing_products(origin_id);
create index sourcing_products_manufacturer on public.sourcing_products(manufacturer_id);
create index sourcing_products_search on public.sourcing_products using gin(to_tsvector('simple', name));
create table public.sourcing_variants (
  product_id text references public.sourcing_products on delete cascade,
  id text,
  name text not null,
  specifications jsonb not null default '{}',
  primary key(product_id, id)
);

create table public.sourcing_offers (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  variant_id text not null,
  business_id uuid not null references public.sourcing_businesses,
  method text not null check (method in ('Local retail','Online retail','Wholesale','Maker-direct','Custom manufacturing','Sample order','Community purchase','Quote only')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_price_minor integer check (unit_price_minor >= 0),
  minimum_quantity integer not null check (minimum_quantity > 0),
  maximum_quantity integer check (maximum_quantity >= minimum_quantity),
  stock_id text references public.sourcing_places,
  pickup_id text references public.sourcing_places,
  shipping_origin_id text references public.sourcing_places,
  shipping_countries text[] not null default '{}',
  lead_days integer check (lead_days >= 0),
  custom_order boolean not null default false,
  expires_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique(business_id, product_id, variant_id, method),
  foreign key(product_id, variant_id) references public.sourcing_variants
);
create index sourcing_offers_variant on public.sourcing_offers(product_id, variant_id);
create index sourcing_offers_shipping on public.sourcing_offers using gin(shipping_countries) where published;
create table public.sourcing_price_tiers (
  offer_id uuid references public.sourcing_offers on delete cascade,
  quantity integer check (quantity > 0),
  unit_price_minor integer not null check (unit_price_minor >= 0),
  primary key(offer_id, quantity)
);

create function sourcing_private.manages(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from sourcing_private.members where business_id = target and user_id = auth.uid());
$$;
revoke all on function sourcing_private.manages(uuid) from public, anon, authenticated;
grant execute on function sourcing_private.manages(uuid) to authenticated;

alter table public.sourcing_places enable row level security;
alter table public.sourcing_categories enable row level security;
alter table public.sourcing_businesses enable row level security;
alter table public.sourcing_products enable row level security;
alter table public.sourcing_variants enable row level security;
alter table public.sourcing_offers enable row level security;
alter table public.sourcing_price_tiers enable row level security;
revoke all on public.sourcing_places, public.sourcing_categories, public.sourcing_businesses,
  public.sourcing_products, public.sourcing_variants, public.sourcing_offers, public.sourcing_price_tiers
  from public, anon, authenticated;
grant select on public.sourcing_places, public.sourcing_categories, public.sourcing_businesses,
  public.sourcing_products, public.sourcing_variants, public.sourcing_offers, public.sourcing_price_tiers
  to anon, authenticated;
create policy sourcing_place_read on public.sourcing_places for select to anon, authenticated using (true);
create policy sourcing_category_read on public.sourcing_categories for select to anon, authenticated using (true);
create policy sourcing_product_read on public.sourcing_products for select to anon, authenticated using (true);
create policy sourcing_variant_read on public.sourcing_variants for select to anon, authenticated using (true);
create policy sourcing_public_business on public.sourcing_businesses for select to anon, authenticated using (published);
create policy sourcing_member_business on public.sourcing_businesses for select to authenticated using (sourcing_private.manages(id));
create policy sourcing_public_offer on public.sourcing_offers for select to anon, authenticated
  using (published and (expires_at is null or expires_at > now())
    and exists (select 1 from public.sourcing_businesses b where b.id = business_id and b.published));
create policy sourcing_member_offer on public.sourcing_offers for select to authenticated using (sourcing_private.manages(business_id));
create policy sourcing_tier_read on public.sourcing_price_tiers for select to anon, authenticated
  using (exists(select 1 from public.sourcing_offers o where o.id = offer_id));
grant insert (business_id,product_id,variant_id,method,currency,unit_price_minor,minimum_quantity,
  maximum_quantity,stock_id,pickup_id,shipping_origin_id,shipping_countries,lead_days,custom_order,expires_at)
  on public.sourcing_offers to authenticated;
grant update (currency,unit_price_minor,minimum_quantity,maximum_quantity,stock_id,pickup_id,
  shipping_origin_id,shipping_countries,lead_days,custom_order,expires_at) on public.sourcing_offers to authenticated;
create policy sourcing_offer_create on public.sourcing_offers for insert to authenticated
  with check (not published and sourcing_private.manages(business_id));
create policy sourcing_offer_edit on public.sourcing_offers for update to authenticated
  using (not published and sourcing_private.manages(business_id))
  with check (not published and sourcing_private.manages(business_id));
