alter table public.journey_orders
  add column original_ready_date date generated always as (
    (created_at at time zone 'UTC')::date + (terms #>> '{quote,production_days}')::integer
  ) stored;

create table public.journey_production_updates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.journey_orders,
  revision integer not null check (revision > 0),
  request_key uuid not null,
  stage text not null check (stage in ('making', 'quality_check', 'packed')),
  completed_quantity integer not null check (completed_quantity between 0 and 1000000),
  ready_date date not null,
  previous_ready_date date,
  date_reason text not null default '' check (char_length(date_reason) <= 500),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default clock_timestamp(),
  unique (order_id, revision),
  unique (order_id, request_key)
);

alter table public.journey_production_updates enable row level security;
revoke all on public.journey_production_updates from public, anon, authenticated;
grant select on public.journey_production_updates to authenticated;
create policy production_update_participant_read on public.journey_production_updates
  for select to authenticated using (
    exists (select 1 from public.journey_orders o where o.id = order_id)
  );

create function sourcing_private.journey_record_production(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  thread_key uuid := (payload->>'thread')::uuid;
  retry_key uuid := (payload->>'requestKey')::uuid;
  stage_name text := payload->>'stage';
  quantity integer := (payload->>'completed')::integer;
  ready_on date := (payload->>'readyDate')::date;
  reason text := trim(coalesce(payload->>'dateReason', ''));
  progress_note text := trim(coalesce(payload->>'note', ''));
  order_row public.journey_orders;
  previous public.journey_production_updates;
  expected integer := (payload->>'expectedRevision')::integer;
  agreed_quantity integer;
  previous_ready date;
  update_id uuid;
begin
  if actor is null or sourcing_private.journey_side(thread_key) is distinct from 'seller' then
    raise exception 'Only the order maker can record production progress' using errcode = '42501';
  end if;
  -- Serialize progress and fulfilment in the same order as the journey action.
  perform 1 from public.journey_threads where id = thread_key for update;
  select * into order_row from public.journey_orders where thread_id = thread_key for update;
  if order_row.id is null then raise exception 'Bulk order required'; end if;

  select id into update_id from public.journey_production_updates
    where order_id = order_row.id and request_key = retry_key;
  if found then return update_id; end if;
  if order_row.status not in ('confirmed', 'preparing') then
    raise exception 'Production updates are closed for this order';
  end if;

  select * into previous from public.journey_production_updates
    where order_id = order_row.id order by revision desc limit 1;
  if expected is distinct from coalesce(previous.revision, 0) then
    raise exception 'Production changed. Reopen the form and review the latest update.';
  end if;

  agreed_quantity := (order_row.terms #>> '{requirement,quantity}')::integer;
  if agreed_quantity is null or quantity is null or quantity < coalesce(previous.completed_quantity, 0)
    or quantity > agreed_quantity then
    raise exception 'Completed quantity cannot decrease or exceed the agreed order quantity';
  end if;
  if stage_name is null or not (
    (previous.stage is null and stage_name = 'making')
    or (previous.stage = 'making' and stage_name in ('making', 'quality_check'))
    or (previous.stage = 'quality_check' and stage_name in ('quality_check', 'packed'))
    or (previous.stage = 'packed' and stage_name = 'packed')
  ) then
    raise exception 'Production must progress from making to quality check to packed';
  end if;
  if stage_name <> 'making' and quantity <> agreed_quantity then
    raise exception 'Complete the full order quantity before quality check or packing';
  end if;

  previous_ready := coalesce(previous.ready_date, order_row.original_ready_date);
  if ready_on is null or not isfinite(ready_on) or ready_on not between date '1900-01-01' and date '9999-12-31' then
    raise exception 'Enter a valid estimated ready date';
  end if;
  if previous_ready is not null and ready_on <> previous_ready and reason = '' then
    raise exception 'Add a reason for changing the ready date';
  end if;

  insert into public.journey_production_updates (
    order_id, revision, request_key, stage, completed_quantity, ready_date, previous_ready_date, date_reason, note
  ) values (
    order_row.id, coalesce(previous.revision, 0) + 1, retry_key, stage_name, quantity, ready_on, previous_ready,
    case when ready_on <> previous_ready then reason else '' end, progress_note
  ) returning id into update_id;

  if order_row.status = 'confirmed' then
    perform sourcing_private.journey_action('fulfil', jsonb_build_object('id', thread_key, 'state', 'preparing'));
  end if;
  update public.journey_threads set updated_at = clock_timestamp() where id = thread_key;
  perform sourcing_private.journey_emit(thread_key, actor, 'buyer', 'production:' || update_id,
    case when ready_on > previous_ready then 'Production delayed'
         when ready_on < previous_ready then 'Production ready date revised'
         else 'Production progress updated' end);
  return update_id;
end;
$$;

create function public.journey_record_production(payload jsonb) returns uuid
language sql security invoker set search_path = '' as $$
  select sourcing_private.journey_record_production(payload);
$$;
revoke all on function public.journey_record_production(jsonb), sourcing_private.journey_record_production(jsonb)
  from public, anon, authenticated;
grant execute on function public.journey_record_production(jsonb), sourcing_private.journey_record_production(jsonb)
  to authenticated;

create function sourcing_private.journey_require_packed() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  last_stage text;
begin
  if new.status in ('ready', 'dispatched') and old.status is distinct from new.status then
    select stage into last_stage from public.journey_production_updates
      where order_id = new.id order by revision desc limit 1;
    if last_stage is not null and last_stage <> 'packed' then
      raise exception 'Pack the tracked order before handing it off for fulfilment';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function sourcing_private.journey_require_packed() from public, anon, authenticated;
create trigger journey_require_packed before update of status on public.journey_orders
  for each row execute function sourcing_private.journey_require_packed();
