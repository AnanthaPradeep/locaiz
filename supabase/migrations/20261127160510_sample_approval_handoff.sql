create table public.journey_samples (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.journey_threads,
  quote_id uuid not null references public.journey_quote_revisions,
  quote_revision integer not null check (quote_revision > 0),
  quantity integer not null check (quantity between 1 and 1000000),
  cost_minor bigint not null check (cost_minor between 0 and 1000000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  lead_days integer not null check (lead_days between 0 and 3650),
  delivery text not null check (delivery in ('shipping', 'pickup')),
  status text not null default 'requested' check (status in (
    'requested', 'preparing', 'dispatched', 'ready', 'received', 'approved', 'changes_requested'
  )),
  feedback text not null default '' check (char_length(feedback) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (thread_id, quote_revision),
  unique (quote_id)
);

alter table public.journey_samples enable row level security;
revoke all on public.journey_samples from public, anon, authenticated;
grant select on public.journey_samples to authenticated;
create policy journey_sample_participant_read on public.journey_samples
  for select to authenticated using (sourcing_private.journey_side(thread_id) is not null);

create function sourcing_private.journey_sample_action(command text, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  thread_key uuid := nullif(payload->>'thread', '')::uuid;
  thread_row public.journey_threads;
  sample_row public.journey_samples;
  quote_row public.journey_quote_revisions;
  actor_side text;
  method text := payload->>'delivery';
  note text := trim(coalesce(payload->>'feedback', ''));
  sample_quantity text[];
  sample_terms text[];
begin
  if actor_id is null then
    raise exception 'Conversation participant required' using errcode = '42501';
  end if;
  -- Quote revisions, sample actions, and order creation serialize on this row.
  select * into thread_row from public.journey_threads where id = thread_key for update;
  actor_side := sourcing_private.journey_side(thread_key);
  if actor_side is null or thread_row.invite_state <> 'accepted' then
    raise exception 'Accepted conversation participant required' using errcode = '42501';
  end if;

  select * into sample_row from public.journey_samples
    where thread_id = thread_key order by quote_revision desc limit 1;
  if command = 'request' then
    if actor_side <> 'buyer' then
      raise exception 'Only the buyer can request a sample' using errcode = '42501';
    end if;
    if sample_row.quote_id = nullif(payload->>'quote', '')::uuid and sample_row.delivery = method then
      return sample_row.id;
    end if;
    if sample_row.id is not null and sample_row.status <> 'changes_requested' then
      raise exception 'There is already a sample for this conversation';
    end if;
    select * into quote_row from public.journey_quote_revisions
      where id = thread_row.latest_quote and thread_id = thread_key;
    if quote_row.id is null or quote_row.id is distinct from nullif(payload->>'quote', '')::uuid
      or quote_row.revision <= coalesce(sample_row.quote_revision, 0)
      or quote_row.expires_at <= clock_timestamp()
      or thread_row.quote_state in ('withdrawn', 'declined')
    then
      raise exception 'A current unexpired sample quote is required';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(thread_row.rfq_id::text, 1));
    if exists (
      select 1 from public.journey_orders o
      join public.journey_threads t on t.id = o.thread_id
      where t.rfq_id = thread_row.rfq_id
    ) then
      raise exception 'A bulk order already exists for this requirement';
    end if;

    select regexp_match(specifications, E'(?:^|\n)Sample quantity: ([1-9][0-9]{0,6})(?:\n|$)')
      into sample_quantity from public.journey_rfqs where id = thread_row.rfq_id;
    sample_terms := regexp_match(quote_row.custom_terms,
      E'^Sample quote \\(separate from bulk\\)\nSample cost \\(minor units\\): ([0-9]{1,13})\nSample lead time \\(days\\): ([0-9]{1,4})\nSample delivery: (Shipping or pickup|Shipping|Pickup)(?:\n|$)');
    if sample_terms is null or sample_quantity is null
      or method is null or method not in ('shipping', 'pickup')
      or (sample_terms[3] <> 'Shipping or pickup' and lower(sample_terms[3]) <> method)
    then
      raise exception 'Choose an offered sample delivery method';
    end if;
    insert into public.journey_samples(thread_id, quote_id, quote_revision, quantity, cost_minor, currency, lead_days, delivery)
      values(thread_key, quote_row.id, quote_row.revision, sample_quantity[1]::integer,
             sample_terms[1]::bigint, quote_row.currency, sample_terms[2]::integer, method)
      returning * into sample_row;
  else
    if sample_row.id is null or sample_row.id is distinct from nullif(payload->>'sample', '')::uuid then
      raise exception 'Current sample required';
    end if;
    if not ((actor_side = 'seller' and command in ('preparing', 'dispatched', 'ready'))
      or (actor_side = 'buyer' and command in ('received', 'approved', 'changes_requested'))) then
      raise exception 'Sample action unavailable to this participant' using errcode = '42501';
    end if;
    if sample_row.status = command and (command not in ('approved', 'changes_requested') or sample_row.feedback = note) then
      return sample_row.id;
    end if;
    if not (
      (sample_row.status = 'requested' and command = 'preparing')
      or (sample_row.status = 'preparing' and (
        (command = 'dispatched' and sample_row.delivery = 'shipping')
        or (command = 'ready' and sample_row.delivery = 'pickup')
      ))
      or (sample_row.status in ('dispatched', 'ready') and command = 'received')
      or (sample_row.status = 'received' and command in ('approved', 'changes_requested'))
    ) then
      raise exception 'Sample cannot move to this status';
    end if;
    if char_length(note) > 1000 or (command = 'changes_requested' and note = '') then
      raise exception 'Provide feedback between 1 and 1,000 characters to request changes';
    end if;
    update public.journey_samples
      set status = command, feedback = case when command in ('approved', 'changes_requested') then note else '' end,
          updated_at = clock_timestamp()
      where id = sample_row.id returning * into sample_row;
  end if;

  update public.journey_threads set updated_at = clock_timestamp() where id = thread_key;
  perform sourcing_private.journey_emit(thread_key, actor_id,
    case when actor_side = 'buyer' then 'seller' else 'buyer' end,
    'sample:' || sample_row.id || ':' || sample_row.status,
    'Sample ' || replace(sample_row.status, '_', ' '));
  return sample_row.id;
end;
$$;

create function public.journey_sample_action(command text, payload jsonb) returns uuid
language sql security invoker set search_path = '' as $$
  select sourcing_private.journey_sample_action(command, payload);
$$;
revoke all on function public.journey_sample_action(text, jsonb), sourcing_private.journey_sample_action(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.journey_sample_action(text, jsonb), sourcing_private.journey_sample_action(text, jsonb)
  to authenticated;

create function sourcing_private.journey_order_approved_sample() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  sample_row public.journey_samples;
begin
  select * into sample_row from public.journey_samples
    where thread_id = new.thread_id order by quote_revision desc limit 1;
  if found then
    if sample_row.status <> 'approved' then
      raise exception 'Approve the current sample before creating the bulk order';
    end if;
    new.terms := new.terms || jsonb_build_object('approvedSample', to_jsonb(sample_row));
  end if;
  return new;
end;
$$;
revoke all on function sourcing_private.journey_order_approved_sample() from public, anon, authenticated;
create trigger journey_order_approved_sample before insert on public.journey_orders
  for each row execute function sourcing_private.journey_order_approved_sample();
