create table public.journey_order_handoffs (
  order_id uuid primary key references public.journey_orders,
  request_key uuid not null,
  method text not null check (method in ('shipping', 'pickup')),
  ordered_quantity integer not null check (ordered_quantity between 1 and 1000000),
  carrier text check (char_length(carrier) between 1 and 120),
  tracking_number text check (char_length(tracking_number) between 1 and 120),
  estimated_delivery date check (isfinite(estimated_delivery)),
  pickup_location text check (char_length(pickup_location) between 1 and 240),
  pickup_start timestamptz check (isfinite(pickup_start)),
  pickup_end timestamptz check (isfinite(pickup_end)),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  created_at timestamptz not null default clock_timestamp(),
  received_quantity integer check (received_quantity between 0 and ordered_quantity),
  receipt_note text not null default '' check (char_length(receipt_note) <= 1000),
  received_at timestamptz,
  receipt_key uuid,
  check (
    (method = 'shipping' and carrier is not null and tracking_number is not null and estimated_delivery is not null
      and pickup_location is null and pickup_start is null and pickup_end is null)
    or (method = 'pickup' and pickup_location is not null and pickup_start is not null and pickup_end is not null
      and pickup_end > pickup_start and carrier is null and tracking_number is null and estimated_delivery is null)
  ),
  check ((received_at is null) = (received_quantity is null) and (received_at is null) = (receipt_key is null))
);

alter table public.journey_order_handoffs enable row level security;
revoke all on public.journey_order_handoffs from public, anon, authenticated;
grant select on public.journey_order_handoffs to authenticated;
create policy journey_handoff_participant_read on public.journey_order_handoffs
  for select to authenticated using (
    exists (select 1 from public.journey_orders o where o.id = order_id)
  );

create function sourcing_private.journey_order_delivery(command text, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  thread_key uuid := (payload->>'thread')::uuid;
  retry_key uuid := (payload->>'requestKey')::uuid;
  actor_side text := sourcing_private.journey_side(thread_key);
  order_row public.journey_orders;
  handoff public.journey_order_handoffs;
  delivery_method text;
  quantity integer;
  received integer;
begin
  if actor is null or actor_side is null
    or command is null or not ((command = 'handoff' and actor_side = 'seller') or (command = 'receipt' and actor_side = 'buyer'))
  then
    raise exception 'Delivery action unavailable to this participant' using errcode = '42501';
  end if;
  if retry_key is null then raise exception 'Delivery request key required'; end if;

  perform 1 from public.journey_threads where id = thread_key for update;
  select * into order_row from public.journey_orders where thread_id = thread_key for update;
  if order_row.id is null then raise exception 'Bulk order required'; end if;
  select * into handoff from public.journey_order_handoffs where order_id = order_row.id;
  delivery_method := order_row.terms #>> '{quote,method}';
  quantity := (order_row.terms #>> '{requirement,quantity}')::integer;

  if command = 'handoff' then
    if handoff.request_key = retry_key then return order_row.id; end if;
    if handoff.order_id is not null or order_row.status <> 'preparing'
      or quantity is null or delivery_method is null or delivery_method not in ('shipping', 'pickup')
    then raise exception 'Order is unavailable for a delivery handoff'; end if;

    insert into public.journey_order_handoffs (
      order_id, request_key, method, ordered_quantity, carrier, tracking_number, estimated_delivery,
      pickup_location, pickup_start, pickup_end, instructions
    ) values (
      order_row.id, retry_key, delivery_method, quantity,
      case when delivery_method = 'shipping' then nullif(trim(payload->>'carrier'), '') end,
      case when delivery_method = 'shipping' then nullif(trim(payload->>'tracking'), '') end,
      case when delivery_method = 'shipping' then (payload->>'estimatedDelivery')::date end,
      case when delivery_method = 'pickup' then nullif(trim(payload->>'location'), '') end,
      case when delivery_method = 'pickup' then (payload->>'pickupStart')::timestamptz end,
      case when delivery_method = 'pickup' then (payload->>'pickupEnd')::timestamptz end,
      case when delivery_method = 'pickup' then trim(coalesce(payload->>'instructions', '')) else '' end
    );
    perform sourcing_private.journey_action('fulfil', jsonb_build_object(
      'id', thread_key, 'state', case when delivery_method = 'shipping' then 'dispatched' else 'ready' end
    ));
  else
    if handoff.receipt_key = retry_key then return order_row.id; end if;
    if handoff.order_id is null or handoff.received_at is not null or order_row.status not in ('dispatched', 'ready') then
      raise exception 'Order is unavailable for receipt confirmation';
    end if;
    received := (payload->>'quantity')::integer;
    if received is null or received < 0 or received > handoff.ordered_quantity then
      raise exception 'Received quantity must be between zero and the agreed quantity';
    end if;
    update public.journey_order_handoffs
      set received_quantity = received, received_at = clock_timestamp(), receipt_key = retry_key,
          receipt_note = trim(coalesce(payload->>'note', ''))
      where order_id = order_row.id;
    update public.journey_orders set
      status = case when received = handoff.ordered_quantity then 'completed' else 'disputed' end,
      updated_at = clock_timestamp()
      where id = order_row.id;
    update public.journey_threads set updated_at = clock_timestamp() where id = thread_key;
    perform sourcing_private.journey_emit(thread_key, actor, 'seller', 'delivery-receipt:' || order_row.id,
      case when received = handoff.ordered_quantity then 'Receipt confirmed' else 'Order shortage reported' end);
  end if;
  return order_row.id;
end;
$$;

create function public.journey_order_delivery(command text, payload jsonb) returns uuid
language sql security invoker set search_path = '' as $$
  select sourcing_private.journey_order_delivery(command, payload);
$$;
revoke all on function public.journey_order_delivery(text, jsonb), sourcing_private.journey_order_delivery(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.journey_order_delivery(text, jsonb), sourcing_private.journey_order_delivery(text, jsonb)
  to authenticated;

create function sourcing_private.journey_verify_order_handoff() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  handoff public.journey_order_handoffs;
begin
  if old.status is not distinct from new.status then return new; end if;
  select * into handoff from public.journey_order_handoffs where order_id = new.id;
  if new.status in ('ready', 'dispatched') and handoff.order_id is null and exists (
    select 1 from public.journey_production_updates where order_id = new.id
  ) then
    raise exception 'Record delivery or pickup details before handing off the tracked order';
  end if;
  if new.status = 'completed' and handoff.order_id is not null
    and handoff.received_quantity is distinct from handoff.ordered_quantity then
    raise exception 'Buyer confirmation of the full quantity is required';
  end if;
  return new;
end;
$$;
revoke all on function sourcing_private.journey_verify_order_handoff() from public, anon, authenticated;
create trigger journey_verify_order_handoff before update of status on public.journey_orders
  for each row execute function sourcing_private.journey_verify_order_handoff();
