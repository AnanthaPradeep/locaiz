alter table public.journey_rfqs
  add column source_order_id uuid references public.journey_orders;
create index journey_rfq_source_order on public.journey_rfqs(source_order_id)
  where source_order_id is not null;

create function sourcing_private.journey_submit_reorder(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  source_key uuid := (payload->>'sourceOrder')::uuid;
  submission_key uuid := (payload->>'submission')::uuid;
  previous public.journey_rfqs;
  request_id uuid;
begin
  if actor is null then raise exception 'Verified account required' using errcode = '42501'; end if;
  if submission_key is null or source_key is null then raise exception 'Reorder reference required'; end if;

  -- Serialize retries with the existing RFQ action and preserve its validation.
  perform pg_advisory_xact_lock(hashtextextended(actor::text || submission_key::text, 0));
  select * into previous from public.journey_rfqs where buyer_id = actor and submission = submission_key;
  if found then
    if previous.source_order_id is distinct from source_key then
      raise exception 'This request is already linked to another submission';
    end if;
    return previous.id;
  end if;

  perform 1 from public.journey_orders
    where id = source_key and buyer_id = actor and status = 'completed' for share;
  if not found then
    raise exception 'Completed buyer order required' using errcode = '42501';
  end if;

  -- A saved brief is a new quote request. Historic catalogue IDs or stock assignments are not reused.
  request_id := sourcing_private.journey_action('submit_rfq', payload - 'product' - 'variant' - 'stockAssignment');
  update public.journey_rfqs set source_order_id = source_key where id = request_id;
  return request_id;
end;
$$;

create function public.journey_submit_reorder(payload jsonb) returns uuid
language sql security invoker set search_path = '' as $$
  select sourcing_private.journey_submit_reorder(payload);
$$;
revoke all on function public.journey_submit_reorder(jsonb), sourcing_private.journey_submit_reorder(jsonb)
  from public, anon, authenticated;
grant execute on function public.journey_submit_reorder(jsonb), sourcing_private.journey_submit_reorder(jsonb)
  to authenticated;
