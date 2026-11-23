-- Browser catalogue IDs are the canonical product references during the pilot.
create schema if not exists stock_private;
revoke all on schema stock_private from public;
grant usage on schema stock_private to authenticated;

create table public.stock_pilots (
  id text primary key,
  city text not null,
  category text not null,
  timezone text not null default 'Asia/Kolkata',
  lifetime interval not null default interval '24 hours'
    check (lifetime between interval '1 hour' and interval '72 hours')
);
create table public.stock_products (
  pilot_id text references public.stock_pilots,
  product_id text,
  variant text,
  primary key (pilot_id, product_id, variant)
);
create table public.stock_businesses (
  id uuid primary key default gen_random_uuid(),
  pilot_id text not null references public.stock_pilots,
  name text not null,
  is_demo boolean not null default true,
  active boolean not null default false
);
create index stock_businesses_pilot_idx on public.stock_businesses(pilot_id) where active;
create table stock_private.business_members (
  business_id uuid references public.stock_businesses on delete cascade,
  user_id uuid references auth.users on delete cascade,
  primary key (business_id, user_id)
);
create index stock_members_user_idx on stock_private.business_members(user_id, business_id);
create table public.stock_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users,
  submission_id uuid not null,
  pilot_id text not null,
  product_id text not null,
  variant text not null,
  quantity integer not null check (quantity between 1 and 99),
  message text check (length(message) <= 500),
  preferred_pickup date,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  cancelled_at timestamptz,
  unique (buyer_id, submission_id),
  foreign key (pilot_id, product_id, variant) references public.stock_products,
  check (expires_at > created_at)
);
create index stock_requests_buyer_idx on public.stock_requests(buyer_id, created_at desc);
create table public.stock_request_shops (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.stock_requests on delete cascade,
  business_id uuid not null references public.stock_businesses,
  shop_name text not null,
  is_demo boolean not null,
  status text not null default 'pending' check (status in ('pending','available','out_of_stock')),
  price numeric(12,2) check (price >= 0 and price <> 'NaN'::numeric),
  currency char(3) check (currency = 'INR'),
  ready_at timestamptz,
  available_quantity integer check (available_quantity between 1 and 9999),
  instructions text check (length(instructions) <= 500),
  note text check (length(note) <= 500),
  quote_expires_at timestamptz,
  restock_at timestamptz,
  responded_at timestamptz,
  responded_by uuid references auth.users,
  unique (request_id, business_id),
  check ((status = 'pending') = (responded_at is null and responded_by is null)),
  check ((status = 'available') = (price is not null and currency is not null and ready_at is not null))
);
create index stock_shops_business_idx on public.stock_request_shops(business_id, request_id);

-- Realtime payloads contain only the recipient's revision, never request text.
create table public.stock_feed (
  user_id uuid primary key references auth.users on delete cascade,
  revision bigint not null default 1
);

alter table public.stock_pilots enable row level security;
alter table public.stock_products enable row level security;
alter table public.stock_businesses enable row level security;
alter table public.stock_requests enable row level security;
alter table public.stock_request_shops enable row level security;
alter table public.stock_feed enable row level security;
alter table stock_private.business_members enable row level security;
revoke all on public.stock_pilots, public.stock_products, public.stock_businesses,
  public.stock_requests, public.stock_request_shops, public.stock_feed from anon, authenticated, public;
grant select on public.stock_pilots, public.stock_products, public.stock_businesses,
  public.stock_requests, public.stock_feed to authenticated;
grant select (id, request_id, business_id, shop_name, is_demo, status, price, currency,
  ready_at, available_quantity, instructions, note, quote_expires_at, restock_at, responded_at)
  on public.stock_request_shops to authenticated;
create policy stock_pilot_read on public.stock_pilots for select to authenticated using (true);
create policy stock_product_read on public.stock_products for select to authenticated using (true);
create policy stock_business_read on public.stock_businesses for select to authenticated using (active);
create policy stock_feed_read on public.stock_feed for select to authenticated using (user_id = (select auth.uid()));

-- These helpers avoid recursive RLS between the parent and assignment tables.
-- They always derive the session identity and expose only boolean membership checks.
create function stock_private.can_read_request(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.stock_requests r where r.id = target and r.buyer_id = auth.uid()
  ) or exists (
    select 1 from public.stock_request_shops s
    join stock_private.business_members m using (business_id)
    where s.request_id = target and m.user_id = auth.uid()
  );
$$;
create function stock_private.can_read_assignment(target uuid, shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.stock_requests r where r.id = target and r.buyer_id = auth.uid()
  ) or exists (
    select 1 from stock_private.business_members m where m.business_id = shop and m.user_id = auth.uid()
  );
$$;
revoke all on function stock_private.can_read_request(uuid), stock_private.can_read_assignment(uuid,uuid) from public;
grant execute on function stock_private.can_read_request(uuid), stock_private.can_read_assignment(uuid,uuid) to authenticated;
create policy stock_request_read on public.stock_requests for select to authenticated
  using (stock_private.can_read_request(id));
create policy stock_assignment_read on public.stock_request_shops for select to authenticated
  using (stock_private.can_read_assignment(request_id, business_id));

create function stock_private.my_stock_businesses() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select business_id from stock_private.business_members where user_id = auth.uid();
$$;

create function stock_private.signal(target uuid) returns void
language sql set search_path = '' as $$
  insert into public.stock_feed(user_id)
  select buyer_id from public.stock_requests where id = target
  union
  select m.user_id from stock_private.business_members m
  join public.stock_request_shops s using (business_id) where s.request_id = target
  order by 1
  on conflict (user_id) do update set revision = stock_feed.revision + 1;
$$;
revoke all on function stock_private.signal(uuid) from public, anon, authenticated;

-- Validated transactional writes are required because clients have read-only grants.
create function stock_private.create_stock_request(
  submission uuid, pilot text, product text, selected_variant text,
  shops uuid[], units integer default 1, buyer_note text default null, pickup_date date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  request_key uuid;
  pilot_settings public.stock_pilots;
begin
  if actor is null or submission is null then raise exception 'Sign in and retry'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stock:' || actor::text, 0));
  select id into request_key from public.stock_requests where buyer_id = actor and submission_id = submission;
  if found then return request_key; end if;
  if units is null or units not between 1 and 99 or length(buyer_note) > 500
    or coalesce(cardinality(shops), 0) not between 1 and 3
    then raise exception 'Check quantity, message and shops'; end if;
  if (select count(*) from public.stock_businesses b where b.active and b.pilot_id = pilot and b.id = any(shops)) <> cardinality(shops)
    then raise exception 'Choose distinct participating shops'; end if;
  select p.* into pilot_settings from public.stock_pilots p where p.id = pilot;
  if not found or not exists (
    select 1 from public.stock_products p where (p.pilot_id, p.product_id, p.variant) = (pilot, product, selected_variant)
  ) then raise exception 'This variant is outside the pilot'; end if;
  if pickup_date is not null and pickup_date < (now() at time zone pilot_settings.timezone)::date
    then raise exception 'Pickup date cannot be in the past'; end if;
  if (select count(*) from public.stock_requests where buyer_id = actor and created_at >= now() - interval '1 hour') >= 5
    then raise exception 'Request limit reached. Try again later.'; end if;
  insert into public.stock_requests(buyer_id, submission_id, pilot_id, product_id, variant, quantity, message, preferred_pickup, expires_at)
    values(actor, submission, pilot, product, selected_variant, units, nullif(trim(buyer_note), ''), pickup_date, now() + pilot_settings.lifetime)
    returning id into request_key;
  insert into public.stock_request_shops(request_id, business_id, shop_name, is_demo)
    select request_key, b.id, b.name, b.is_demo from public.stock_businesses b where b.id = any(shops);
  perform stock_private.signal(request_key);
  return request_key;
end;
$$;

create function stock_private.reply_stock_request(
  assignment uuid, outcome text, amount numeric default null, currency_code text default null,
  pickup_time timestamptz default null, units integer default null, pickup_note text default null,
  seller_note text default null, valid_until timestamptz default null, restock_time timestamptz default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  assigned public.stock_request_shops;
  parent public.stock_requests;
begin
  select s.* into assigned from public.stock_request_shops s
  join stock_private.business_members m using (business_id)
  where s.id = assignment and m.user_id = actor;
  if not found then raise exception 'Assignment unavailable'; end if;
  select * into parent from public.stock_requests where id = assigned.request_id for update;
  select * into assigned from public.stock_request_shops where id = assignment for update;
  if parent.cancelled_at is not null or parent.expires_at <= clock_timestamp() then raise exception 'Request is closed'; end if;
  if assigned.status <> 'pending' then return; end if;
  if outcome is null or outcome not in ('available','out_of_stock')
    or length(pickup_note) > 500 or length(seller_note) > 500
    or (valid_until is not null and valid_until <= clock_timestamp())
    or (units is not null and units not between 1 and 9999)
    then raise exception 'Invalid response'; end if;
  if outcome = 'available' and (
       amount is null or amount < 0 or amount > 9999999999.99 or scale(amount) > 2
       or currency_code is distinct from 'INR' or pickup_time is null or pickup_time < clock_timestamp() - interval '1 minute'
       or restock_time is not null
     ) then raise exception 'Enter a valid INR price and pickup time'; end if;
  if outcome = 'out_of_stock' and (
       amount is not null or currency_code is not null or pickup_time is not null or units is not null
       or pickup_note is not null or valid_until is not null
       or (restock_time is not null and restock_time < clock_timestamp())
     ) then raise exception 'Invalid restock reply'; end if;
  update public.stock_request_shops set status = outcome, price = amount, currency = currency_code,
    ready_at = pickup_time, available_quantity = units, instructions = pickup_note, note = seller_note,
    quote_expires_at = valid_until, restock_at = restock_time, responded_at = clock_timestamp(),
    responded_by = actor where id = assignment;
  perform stock_private.signal(parent.id);
end;
$$;

create function stock_private.cancel_stock_request(request_key uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.stock_requests where id = request_key and buyer_id = auth.uid() for update;
  if not found then raise exception 'Request cannot be cancelled'; end if;
  update public.stock_requests set cancelled_at = clock_timestamp()
    where id = request_key and cancelled_at is null and expires_at > clock_timestamp()
      and exists (select 1 from public.stock_request_shops where request_id = request_key and status = 'pending');
  if not found then raise exception 'Request cannot be cancelled'; end if;
  perform stock_private.signal(request_key);
end;
$$;

-- PostgREST sees only the invoker façades. The privileged implementations
-- remain in a schema outside the API and still verify the session identity.
create function public.my_stock_businesses() returns setof uuid
language sql stable set search_path = '' as $$
  select stock_private.my_stock_businesses();
$$;
create function public.create_stock_request(
  submission uuid, pilot text, product text, selected_variant text,
  shops uuid[], units integer default 1, buyer_note text default null, pickup_date date default null
) returns uuid language sql set search_path = '' as $$
  select stock_private.create_stock_request($1,$2,$3,$4,$5,$6,$7,$8);
$$;
create function public.reply_stock_request(
  assignment uuid, outcome text, amount numeric default null, currency_code text default null,
  pickup_time timestamptz default null, units integer default null, pickup_note text default null,
  seller_note text default null, valid_until timestamptz default null, restock_time timestamptz default null
) returns void language sql set search_path = '' as $$
  select stock_private.reply_stock_request($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);
$$;
create function public.cancel_stock_request(request_key uuid) returns void
language sql set search_path = '' as $$
  select stock_private.cancel_stock_request($1);
$$;

revoke all on function stock_private.my_stock_businesses(),
 stock_private.create_stock_request(uuid,text,text,text,uuid[],integer,text,date),
 stock_private.reply_stock_request(uuid,text,numeric,text,timestamptz,integer,text,text,timestamptz,timestamptz),
 stock_private.cancel_stock_request(uuid) from public, anon, authenticated;
grant execute on function stock_private.my_stock_businesses(),
 stock_private.create_stock_request(uuid,text,text,text,uuid[],integer,text,date),
 stock_private.reply_stock_request(uuid,text,numeric,text,timestamptz,integer,text,text,timestamptz,timestamptz),
 stock_private.cancel_stock_request(uuid) to authenticated;

revoke all on function public.my_stock_businesses() from public, anon, authenticated;
grant execute on function public.my_stock_businesses() to authenticated;
revoke all on function public.create_stock_request(uuid,text,text,text,uuid[],integer,text,date),
 public.reply_stock_request(uuid,text,numeric,text,timestamptz,integer,text,text,timestamptz,timestamptz),
 public.cancel_stock_request(uuid) from public, anon, authenticated;
grant execute on function public.create_stock_request(uuid,text,text,text,uuid[],integer,text,date),
 public.reply_stock_request(uuid,text,numeric,text,timestamptz,integer,text,text,timestamptz,timestamptz),
 public.cancel_stock_request(uuid) to authenticated;

alter publication supabase_realtime add table public.stock_feed;

insert into public.stock_pilots(id,city,category) values ('nagercoil','Nagercoil, Tamil Nadu, India','Electronics & Accessories');
insert into public.stock_products(pilot_id,product_id,variant)
  values ('nagercoil','studio-headphones','Standard'), ('nagercoil','studio-headphones','Gift packaging'),
         ('nagercoil','audio-pads','Standard'), ('nagercoil','audio-pads','Gift packaging');
