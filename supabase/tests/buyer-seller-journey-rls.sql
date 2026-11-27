
begin;
insert into public.sourcing_places(id,name,kind) values('journey-test-place','Journey test locality','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values('30000000-0000-4000-8000-000000000001','Journey test supplier','journey-test-place',array['Artisan'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '30000000-0000-4000-8000-000000000001',id,'owner' from auth.users where email='seller-a@stock.example.com';
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values('30000000-0000-4000-8000-000000000002','Alternate test maker','journey-test-place',array['Artisan'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '30000000-0000-4000-8000-000000000002',id,'owner' from auth.users where email='seller-b@stock.example.com';
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
select set_config('journey_test.rfq',public.journey_action('submit_rfq',
 '{"submission":"40000000-0000-4000-8000-000000000001","title":"Handmade QA basket","specifications":"Craft: Chettinad baskets\nSample quantity: 2","quantity":10,"unit":"units","destination":"Chennai","currency":"INR","businesses":["30000000-0000-4000-8000-000000000001"]}')::text,true);
select set_config('journey_test.thread',(select id::text from public.journey_threads where rfq_id=current_setting('journey_test.rfq')::uuid),true);
select public.journey_action('message',jsonb_build_object('id',current_setting('journey_test.thread'),
 'requestKey','40000000-0000-4000-8000-000000000002','body','Could you confirm a price?'));
select public.journey_action('message',jsonb_build_object('id',current_setting('journey_test.thread'),
 'requestKey','40000000-0000-4000-8000-000000000002','body','Could you confirm a price?'));
do $$begin
 if (select count(*) from public.journey_messages where thread_id=current_setting('journey_test.thread')::uuid)<>1
  then raise exception 'Duplicate retry'; end if;
 if exists(select 1 from public.journey_events where thread_id=current_setting('journey_test.thread')::uuid)
  then raise exception 'Buyer read seller notifications'; end if;
end $$;
do $$
declare
 attachment_prefix text := current_setting('journey_test.thread') || '/' || auth.uid() || '/';
begin
 insert into storage.objects(bucket_id,name) values
  ('journey-private',attachment_prefix || '40000000-0000-4000-8000-000000000003.pdf');
 begin
  insert into storage.objects(bucket_id,name) values
   ('journey-private',attachment_prefix || 'nested/document.pdf');
  raise exception 'Storage accepted an invalid attachment path';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-b@stock.example.com'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.journey_rfqs where id=current_setting('journey_test.rfq')::uuid)
  or exists(select 1 from public.journey_messages where thread_id=current_setting('journey_test.thread')::uuid)
  then raise exception 'RFQ or message visible across businesses'; end if;
 begin
  perform public.journey_action('invite_reply',jsonb_build_object('id',current_setting('journey_test.thread'),'state','accepted'));
  raise exception 'Cross-business reply allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.journey_action('invite_reply',jsonb_build_object('id',current_setting('journey_test.thread'),'state','accepted'));
select public.journey_action('submit_quote',jsonb_build_object('id',current_setting('journey_test.thread'),'currency','USD','unitMinor',210,
 'moq',5,'production',2,'supported',true,'method','shipping','expires',now()+interval '7 days'));
select public.journey_action('submit_quote',jsonb_build_object('id',current_setting('journey_test.thread'),'currency','INR','unitMinor',5000,
 'moq',5,'production',2,'transit',1,'shipping',1000,'tax',0,'duties',0,'other',0,
 'customTerms',E'Sample quote (separate from bulk)\nSample cost (minor units): 2500\nSample lead time (days): 5\nSample delivery: Shipping or pickup',
 'tiers','[{"quantity":10,"minor":4500}]'::jsonb,'supported',true,'method','shipping','expires',now()+interval '7 days'));
select set_config('journey_test.quote',(select latest_quote::text from public.journey_threads where id=current_setting('journey_test.thread')::uuid),true);
do $$begin
 if (select count(*) from public.journey_quote_revisions where thread_id=current_setting('journey_test.thread')::uuid)<>2
  then raise exception 'Revision history lost'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
select set_config('journey_test.sample',public.journey_sample_action('request',jsonb_build_object(
 'thread',current_setting('journey_test.thread'),'quote',current_setting('journey_test.quote'),'delivery','shipping'))::text,true);
do $$
declare payload jsonb := jsonb_build_object('thread',current_setting('journey_test.thread'),'quote',current_setting('journey_test.quote'),'delivery','shipping');
begin
 if public.journey_sample_action('request', payload)::text <> current_setting('journey_test.sample')
 then raise exception 'Duplicate sample request changed the ID'; end if;
 begin
  perform public.journey_sample_action('preparing',jsonb_build_object('thread',current_setting('journey_test.thread'),'sample',current_setting('journey_test.sample')));
  raise exception 'Buyer moved seller status';
 exception when insufficient_privilege then null; end;
end $$;
select public.journey_action('select_quote',jsonb_build_object('id',current_setting('journey_test.thread'),'quote',current_setting('journey_test.quote')));
do $$begin
 if not exists(select 1 from public.journey_events where thread_id=current_setting('journey_test.thread')::uuid and kind='Quote selected')
 then raise exception 'Buyer cannot see their own quote selection in their timeline';end if;
end $$;
do $$begin
 if exists(select 1 from public.journey_orders where thread_id=current_setting('journey_test.thread')::uuid)
 then raise exception 'Selection created an order'; end if;
 begin
  perform public.journey_action('create_order',jsonb_build_object('id',current_setting('journey_test.thread'),'quote',current_setting('journey_test.quote')));
  raise exception 'Buyer ordered before supplier confirmation';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.journey_action('confirm_terms',jsonb_build_object('id',current_setting('journey_test.thread'),'quote',current_setting('journey_test.quote')));
select public.journey_sample_action('preparing',jsonb_build_object('thread',current_setting('journey_test.thread'),'sample',current_setting('journey_test.sample')));
select public.journey_sample_action('dispatched',jsonb_build_object('thread',current_setting('journey_test.thread'),'sample',current_setting('journey_test.sample')));
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
do $$begin
 begin
  perform public.journey_action('create_order',jsonb_build_object('id',current_setting('journey_test.thread'),'quote',current_setting('journey_test.quote')));
  raise exception 'Bulk order created before sample approval';
 exception when raise_exception then
  if sqlerrm <> 'Approve the current sample before creating the bulk order' then raise; end if;
 end;
end $$;
select public.journey_sample_action('received',jsonb_build_object('thread',current_setting('journey_test.thread'),'sample',current_setting('journey_test.sample')));
select public.journey_sample_action('approved',jsonb_build_object('thread',current_setting('journey_test.thread'),'sample',current_setting('journey_test.sample'),'feedback','Handle size approved'));
select public.journey_action('create_order',jsonb_build_object('id',current_setting('journey_test.thread'),'quote',current_setting('journey_test.quote')));
select public.journey_action('create_order',jsonb_build_object('id',current_setting('journey_test.thread'),'quote',current_setting('journey_test.quote')));
do $$begin
 if (select count(*) from public.journey_orders where thread_id=current_setting('journey_test.thread')::uuid and terms->>'totalMinor'='46000'
  and terms#>>'{approvedSample,feedback}'='Handle size approved')<>1
  then raise exception 'Order is missing, duplicated, or incorrectly priced'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
do $$
declare
 thread_key uuid := current_setting('journey_test.thread')::uuid;
 original_date date;
 payload jsonb;
 first_update uuid;
begin
 select original_ready_date into original_date from public.journey_orders where thread_id = thread_key;
 payload := jsonb_build_object('thread',thread_key,'stage','making','completed',4,
  'readyDate',original_date,'expectedRevision',0,'requestKey',gen_random_uuid());
 first_update := public.journey_record_production(payload);
 if public.journey_record_production(payload) <> first_update then raise exception 'Production retry duplicated an update'; end if;
 begin
  perform public.journey_record_production(payload || jsonb_build_object(
   'requestKey',gen_random_uuid(),'completed',11,'expectedRevision',1));
  raise exception 'Exceeded ordered quantity';
 exception when raise_exception then
  if sqlerrm <> 'Completed quantity cannot decrease or exceed the agreed order quantity' then raise; end if;
 end;
 begin
  perform public.journey_record_production(payload || jsonb_build_object(
   'requestKey',gen_random_uuid(),'readyDate',original_date+2,'expectedRevision',1));
  raise exception 'Accepted a delayed date without a reason';
 exception when raise_exception then
  if sqlerrm <> 'Add a reason for changing the ready date' then raise; end if;
 end;
 begin
  perform public.journey_action('fulfil',jsonb_build_object('id',thread_key,'state','dispatched'));
  raise exception 'Dispatched before packing';
 exception when raise_exception then
  if sqlerrm <> 'Pack the tracked order before handing it off for fulfilment' then raise; end if;
 end;
 payload := payload || jsonb_build_object('readyDate',original_date+2,'completed',10);
 perform public.journey_record_production(payload || jsonb_build_object(
  'requestKey',gen_random_uuid(),'stage','quality_check','expectedRevision',1,'dateReason','Weaving delayed'));
 perform public.journey_record_production(payload || jsonb_build_object(
  'requestKey',gen_random_uuid(),'stage','packed','expectedRevision',2));
 if not exists(select 1 from public.journey_orders o
  join public.journey_production_updates p on p.order_id=o.id where o.thread_id=thread_key
  and o.original_ready_date=original_date and p.revision=2 and p.ready_date=original_date+2
  and p.previous_ready_date=original_date and p.date_reason='Weaving delayed')
 then raise exception 'Production estimate history was not preserved'; end if;
end $$;
do $$
declare
 thread_key uuid := current_setting('journey_test.thread')::uuid;
 payload jsonb := jsonb_build_object('thread',thread_key,'requestKey',gen_random_uuid(),
  'carrier','Test carrier','tracking','QA-100','estimatedDelivery',current_date+4);
 order_key uuid;
begin
 begin
  perform public.journey_action('fulfil',jsonb_build_object('id',thread_key,'state','dispatched'));
  raise exception 'Tracked order dispatched without shipping details';
 exception when raise_exception then
  if sqlerrm <> 'Record delivery or pickup details before handing off the tracked order' then raise; end if;
 end;
 order_key := public.journey_order_delivery('handoff',payload);
 if public.journey_order_delivery('handoff',payload) <> order_key
 then raise exception 'Handoff retry changed order'; end if;
 begin
  perform public.journey_action('fulfil',jsonb_build_object('id',thread_key,'state','completed'));
  raise exception 'Maker completed the order without buyer receipt';
 exception when raise_exception then
  if sqlerrm <> 'Buyer confirmation of the full quantity is required' then raise; end if;
 end;
 begin
  perform public.journey_order_delivery('receipt',payload || jsonb_build_object('quantity',10));
  raise exception 'Maker can confirm receipt';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
do $$begin
 if (select count(*) from public.journey_production_updates p join public.journey_orders o on o.id=p.order_id
   where o.thread_id=current_setting('journey_test.thread')::uuid) <> 3
 then raise exception 'Buyer cannot read the production history'; end if;
 begin
  perform public.journey_record_production(jsonb_build_object('thread',current_setting('journey_test.thread')));
  raise exception 'Buyer can record maker progress';
 exception when insufficient_privilege then null; end;
end $$;
do $$
declare
 thread_key uuid := current_setting('journey_test.thread')::uuid;
 payload jsonb := jsonb_build_object('thread',thread_key,'requestKey',gen_random_uuid(),'quantity',7);
 order_key uuid;
begin
 begin
  perform public.journey_order_delivery('receipt',payload || jsonb_build_object('quantity',11));
  raise exception 'Accepted quantity over the agreed amount';
 exception when raise_exception then
  if sqlerrm <> 'Received quantity must be between zero and the agreed quantity' then raise; end if;
 end;
 order_key := public.journey_order_delivery('receipt',payload);
 if public.journey_order_delivery('receipt',payload) <> order_key then raise exception 'Receipt retry changed order'; end if;
 if not exists(select 1 from public.journey_order_handoffs h
  join public.journey_orders o on o.id=h.order_id where o.id=order_key
  and o.status='disputed' and h.received_quantity=7 and h.tracking_number='QA-100')
 then raise exception 'Shortage receipt did not put the order in dispute'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
do $$
declare
 payload jsonb := jsonb_build_object('thread',current_setting('journey_test.thread'),'requestKey',gen_random_uuid(),
  'quantity',3,'method','pickup','expectedDate',current_date+1);
 replacement uuid;
begin
 begin
  perform public.journey_order_replacement('propose',payload || jsonb_build_object('quantity',4));
  raise exception 'Accepted a proposal larger than the shortage';
 exception when raise_exception then
  if sqlerrm <> 'Replacement quantity must be within the outstanding shortage' then raise; end if;
 end;
 replacement := public.journey_order_replacement('propose',payload);
 perform set_config('journey_test.replacement',replacement::text,true);
 if public.journey_order_replacement('propose',payload) <> replacement then raise exception 'Duplicate proposal'; end if;
 begin
  perform public.journey_order_replacement('accept',payload || jsonb_build_object('replacement',replacement));
  raise exception 'Maker accepted a replacement on behalf of buyer';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
do $$
declare
 replacement uuid := current_setting('journey_test.replacement')::uuid;
 payload jsonb := jsonb_build_object('thread',current_setting('journey_test.thread'),'requestKey',gen_random_uuid(),
  'replacement',replacement,'quantity',3);
begin
 begin
  perform public.journey_order_replacement('receive',payload);
  raise exception 'Buyer recorded a receipt before accepting replacement';
 exception when raise_exception then
  if sqlerrm <> 'An accepted replacement awaiting receipt is required' then raise; end if;
 end;
 perform public.journey_order_replacement('accept',payload);
 perform public.journey_order_replacement('receive',payload);
 if public.journey_order_replacement('receive',payload) <> replacement then raise exception 'Receipt retry changed the replacement'; end if;
 if not exists(select 1 from public.journey_orders o
  join public.journey_order_handoffs h on o.id=h.order_id
  join public.journey_order_replacements r on h.order_id=r.order_id
  where r.id=replacement and o.status='completed' and h.received_quantity=7 and r.received_quantity=3)
 then raise exception 'Replacement did not complete order with original receipt preserved'; end if;
end $$;
do $$
declare
 source_key uuid;
 request_id uuid;
 payload jsonb;
begin
 select id into source_key from public.journey_orders where thread_id=current_setting('journey_test.thread')::uuid;
 perform set_config('journey_test.source',source_key::text,true);
 payload := jsonb_build_object('sourceOrder',source_key,'submission',gen_random_uuid(),
  'title','Saved design reorder','specifications','Same handle and weave','quantity',100,'unit','units',
  'destination','Coimbatore','currency','INR','deadline',current_date+10,
  'businesses',jsonb_build_array('30000000-0000-4000-8000-000000000002'));
 request_id := public.journey_submit_reorder(payload);
 perform set_config('journey_test.reorder',request_id::text,true);
 if public.journey_submit_reorder(payload) <> request_id then raise exception 'Reorder retry duplicated the RFQ'; end if;
 if not exists(select 1 from public.journey_rfqs where id=request_id and source_order_id=source_key
  and quantity=100 and destination='Coimbatore' and specifications='Same handle and weave')
 then raise exception 'Reorder source or editable terms were lost'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-b@stock.example.com'),true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.journey_rfqs where id=current_setting('journey_test.reorder')::uuid
   and specifications='Same handle and weave')
 then raise exception 'Alternate maker cannot read shared reorder specifications'; end if;
 if exists(select 1 from public.journey_orders where id=current_setting('journey_test.source')::uuid)
 then raise exception 'Alternate maker can read the original order'; end if;
 begin
  perform public.journey_submit_reorder(jsonb_build_object('sourceOrder',current_setting('journey_test.source'),'submission',gen_random_uuid()));
  raise exception 'Non-owner could reorder the source order';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.journey_samples where thread_id=current_setting('journey_test.thread')::uuid)
 then raise exception 'Cross-business sample visibility'; end if;
 if exists(select 1 from public.journey_production_updates)
 then raise exception 'Cross-business production visibility'; end if;
 if exists(select 1 from public.journey_order_handoffs)
 then raise exception 'Cross-business delivery visibility'; end if;
 if exists(select 1 from public.journey_order_replacements)
 then raise exception 'Cross-business replacement visibility'; end if;
 begin
  perform public.journey_order_replacement('propose',jsonb_build_object('thread',current_setting('journey_test.thread'),'requestKey',gen_random_uuid()));
  raise exception 'Cross-business replacement mutation';
 exception when insufficient_privilege then null; end;
 begin
  perform public.journey_order_delivery('handoff',jsonb_build_object('thread',current_setting('journey_test.thread'),'requestKey',gen_random_uuid()));
  raise exception 'Cross-business delivery mutation';
 exception when insufficient_privilege then null; end;
 begin
  perform public.journey_record_production(jsonb_build_object('thread',current_setting('journey_test.thread')));
  raise exception 'Cross-business production mutation';
 exception when insufficient_privilege then null; end;
 begin
  perform public.journey_sample_action('preparing',jsonb_build_object('thread',current_setting('journey_test.thread'),'sample',current_setting('journey_test.sample')));
  raise exception 'Cross-business sample mutation';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.journey_messages; raise exception 'Anonymous conversation access';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
