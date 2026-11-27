create table public.journey_order_replacements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.journey_order_handoffs(order_id),
  propose_key uuid not null,
  quantity integer not null check (quantity between 1 and 1000000),
  method text not null check (method in ('shipping', 'pickup')),
  expected_date date not null check (expected_date between date '1900-01-01' and date '9999-12-31'),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  proposed_at timestamptz not null default clock_timestamp(),
  accepted_at timestamptz,
  accept_key uuid,
  received_at timestamptz,
  receive_key uuid,
  received_quantity integer check (received_quantity between 0 and quantity),
  check ((accepted_at is null) = (accept_key is null)),
  check ((received_at is null) = (receive_key is null) and (received_at is null) = (received_quantity is null)),
  check (received_at is null or accepted_at is not null),
  unique (order_id, propose_key)
);
create unique index journey_one_pending_replacement on public.journey_order_replacements(order_id)
  where received_at is null;
create index journey_replacement_history on public.journey_order_replacements(order_id, proposed_at desc);

alter table public.journey_order_replacements enable row level security;
revoke all on public.journey_order_replacements from public, anon, authenticated;
grant select on public.journey_order_replacements to authenticated;
create policy journey_replacement_participant_read on public.journey_order_replacements
  for select to authenticated using (
    exists (select 1 from public.journey_order_handoffs h where h.order_id = journey_order_replacements.order_id)
  );

create function sourcing_private.journey_order_replacement(command text, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  thread_key uuid := (payload->>'thread')::uuid;
  retry_key uuid := (payload->>'requestKey')::uuid;
  actor_side text := sourcing_private.journey_side(thread_key);
  order_row public.journey_orders;
  handoff public.journey_order_handoffs;
  replacement public.journey_order_replacements;
  outstanding integer;
  units integer;
  event_kind text;
begin
  if actor is null or actor_side is null or command is null or not (
    (command = 'propose' and actor_side = 'seller') or (command in ('accept', 'receive') and actor_side = 'buyer')
  ) then
    raise exception 'Replacement action unavailable to this participant' using errcode = '42501';
  end if;
  if retry_key is null then raise exception 'Replacement request key required'; end if;

  perform 1 from public.journey_threads where id = thread_key for update;
  select * into order_row from public.journey_orders where thread_id = thread_key for update;
  select * into handoff from public.journey_order_handoffs where order_id = order_row.id;
  if handoff.received_quantity is null or handoff.received_quantity >= handoff.ordered_quantity then
    raise exception 'A recorded shortage is required';
  end if;

  if command = 'propose' then
    select * into replacement from public.journey_order_replacements
      where order_id = order_row.id and propose_key = retry_key;
    if found then return replacement.id; end if;
  else
    select * into replacement from public.journey_order_replacements
      where order_id = order_row.id and id = (payload->>'replacement')::uuid;
    if not found then raise exception 'Replacement unavailable'; end if;
    if (command = 'accept' and replacement.accept_key = retry_key)
      or (command = 'receive' and replacement.receive_key = retry_key)
    then return replacement.id; end if;
  end if;
  if order_row.status <> 'disputed' then raise exception 'The shortage is no longer open'; end if;

  select handoff.ordered_quantity - handoff.received_quantity - coalesce(sum(received_quantity), 0)
    into outstanding from public.journey_order_replacements where order_id = order_row.id;
  if command = 'propose' then
    if exists (select 1 from public.journey_order_replacements where order_id = order_row.id and received_at is null)
    then raise exception 'Finish the current replacement before proposing another'; end if;
    units := (payload->>'quantity')::integer;
    if units is null or units < 1 or units > outstanding then
      raise exception 'Replacement quantity must be within the outstanding shortage';
    end if;
    insert into public.journey_order_replacements (order_id, propose_key, quantity, method, expected_date, instructions)
      values (order_row.id, retry_key, units, payload->>'method', (payload->>'expectedDate')::date,
        trim(coalesce(payload->>'instructions', '')))
      returning * into replacement;
    event_kind := 'Replacement proposed';
  elsif command = 'accept' then
    if replacement.accepted_at is not null then raise exception 'Replacement already accepted'; end if;
    update public.journey_order_replacements set accepted_at = clock_timestamp(), accept_key = retry_key
      where id = replacement.id;
    event_kind := 'Replacement accepted';
  else
    if replacement.accepted_at is null or replacement.received_at is not null then
      raise exception 'An accepted replacement awaiting receipt is required';
    end if;
    units := (payload->>'quantity')::integer;
    if units is null or units < 0 or units > least(replacement.quantity, outstanding) then
      raise exception 'Received quantity exceeds the replacement or outstanding shortage';
    end if;
    update public.journey_order_replacements
      set received_at = clock_timestamp(), receive_key = retry_key, received_quantity = units
      where id = replacement.id;
    if units = outstanding then
      update public.journey_orders set status = 'completed', updated_at = clock_timestamp() where id = order_row.id;
      event_kind := 'Replacement resolved shortage';
    else
      event_kind := 'Replacement received';
    end if;
  end if;

  update public.journey_threads set updated_at = clock_timestamp() where id = thread_key;
  perform sourcing_private.journey_emit(thread_key, actor, case when actor_side = 'seller' then 'buyer' else 'seller' end,
    'replacement:' || replacement.id || ':' || command, event_kind);
  return replacement.id;
end;
$$;

create function public.journey_order_replacement(command text, payload jsonb) returns uuid
language sql security invoker set search_path = '' as $$
  select sourcing_private.journey_order_replacement(command, payload);
$$;
revoke all on function public.journey_order_replacement(text, jsonb), sourcing_private.journey_order_replacement(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.journey_order_replacement(text, jsonb), sourcing_private.journey_order_replacement(text, jsonb)
  to authenticated;

create or replace function sourcing_private.journey_verify_order_handoff() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  handoff public.journey_order_handoffs;
  replacement_quantity bigint;
begin
  if old.status is not distinct from new.status then return new; end if;
  select * into handoff from public.journey_order_handoffs where order_id = new.id;
  if new.status in ('ready', 'dispatched') and handoff.order_id is null and exists (
    select 1 from public.journey_production_updates where order_id = new.id
  ) then
    raise exception 'Record delivery or pickup details before handing off the tracked order';
  end if;
  if new.status = 'completed' and handoff.order_id is not null then
    select coalesce(sum(received_quantity), 0) into replacement_quantity
      from public.journey_order_replacements where order_id = new.id;
    if handoff.received_quantity is null or handoff.received_quantity + replacement_quantity <> handoff.ordered_quantity then
      raise exception 'Buyer confirmation of the full quantity is required';
    end if;
  end if;
  return new;
end;
$$;
