create table public.journey_saved_designs (
  id uuid primary key,
  buyer_id uuid not null references auth.users,
  source_order_id uuid not null references public.journey_orders,
  copied_from uuid references public.journey_saved_designs,
  name text not null check (char_length(trim(name)) between 3 and 120),
  specifications text not null check (char_length(specifications) <= 3000),
  search_document tsvector generated always as (
    to_tsvector('simple'::regconfig, name || ' ' || specifications)
  ) stored,
  created_at timestamptz not null default clock_timestamp()
);
create index journey_designs_buyer on public.journey_saved_designs(buyer_id, created_at desc, id);
create index journey_designs_order on public.journey_saved_designs(source_order_id);
create index journey_designs_parent on public.journey_saved_designs(copied_from) where copied_from is not null;
create index journey_designs_search on public.journey_saved_designs using gin(search_document);

alter table public.journey_saved_designs enable row level security;
revoke all on public.journey_saved_designs from public, anon, authenticated;
grant select on public.journey_saved_designs to authenticated;
create policy journey_designs_owner_read on public.journey_saved_designs
  for select to authenticated using (buyer_id = (select auth.uid()));

create function sourcing_private.journey_save_design(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  design_key uuid := (payload->>'id')::uuid;
  source_key uuid := (payload->>'sourceOrder')::uuid;
  parent_key uuid := (payload->>'copiedFrom')::uuid;
  existing public.journey_saved_designs;
begin
  if actor is null or not exists (select 1 from auth.users where id = actor and email_confirmed_at is not null) then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  if design_key is null or source_key is null then raise exception 'Design and source order required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text || design_key::text, 7));
  select * into existing from public.journey_saved_designs where buyer_id = actor and id = design_key;
  if found then
    if existing.source_order_id is distinct from source_key or existing.copied_from is distinct from parent_key then
      raise exception 'Design key belongs to another source';
    end if;
    return existing.id;
  end if;

  if parent_key is null then
    perform 1 from public.journey_orders
      where id = source_key and buyer_id = actor and status = 'completed' for share;
    if not found then raise exception 'Completed buyer order required' using errcode = '42501'; end if;
  elsif not exists (
    select 1 from public.journey_saved_designs
      where id = parent_key and buyer_id = actor and source_order_id = source_key
  ) then
    raise exception 'Owned source design required' using errcode = '42501';
  end if;
  insert into public.journey_saved_designs (id, buyer_id, source_order_id, copied_from, name, specifications)
    values (design_key, actor, source_key, parent_key, trim(payload->>'name'), trim(coalesce(payload->>'specifications', '')));
  return design_key;
end;
$$;

create function public.journey_save_design(payload jsonb) returns uuid
language sql security invoker set search_path = '' as $$
  select sourcing_private.journey_save_design(payload);
$$;
revoke all on function public.journey_save_design(jsonb), sourcing_private.journey_save_design(jsonb)
  from public, anon, authenticated;
grant execute on function public.journey_save_design(jsonb), sourcing_private.journey_save_design(jsonb)
  to authenticated;
