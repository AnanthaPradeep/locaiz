
begin;
insert into public.sourcing_places(id,name,kind) values('journey-test-place','Journey test locality','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values('30000000-0000-4000-8000-000000000001','Journey test supplier','journey-test-place',array['Artisan'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '30000000-0000-4000-8000-000000000001',id,'owner' from auth.users where email='seller-a@stock.example.com';
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
select set_config('journey_test.rfq',public.journey_action('submit_rfq',
 '{"submission":"40000000-0000-4000-8000-000000000001","title":"Handmade QA basket","quantity":10,"unit":"units","destination":"Chennai","currency":"INR","businesses":["30000000-0000-4000-8000-000000000001"]}')::text,true);
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
 'tiers','[{"quantity":10,"minor":4500}]'::jsonb,'supported',true,'method','shipping','expires',now()+interval '7 days'));
select set_config('journey_test.quote',(select latest_quote::text from public.journey_threads where id=current_setting('journey_test.thread')::uuid),true);
do $$begin
 if (select count(*) from public.journey_quote_revisions where thread_id=current_setting('journey_test.thread')::uuid)<>2
  then raise exception 'Revision history lost'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
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
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
select public.journey_action('create_order',jsonb_build_object('id',current_setting('journey_test.thread'),'quote',current_setting('journey_test.quote')));
select public.journey_action('create_order',jsonb_build_object('id',current_setting('journey_test.thread'),'quote',current_setting('journey_test.quote')));
do $$begin
 if (select count(*) from public.journey_orders where thread_id=current_setting('journey_test.thread')::uuid and terms->>'totalMinor'='46000')<>1
  then raise exception 'Order is missing, duplicated, or incorrectly priced'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.journey_action('fulfil',jsonb_build_object('id',current_setting('journey_test.thread'),'state','preparing'));
select public.journey_action('fulfil',jsonb_build_object('id',current_setting('journey_test.thread'),'state','dispatched'));
select public.journey_action('fulfil',jsonb_build_object('id',current_setting('journey_test.thread'),'state','completed'));
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.journey_messages; raise exception 'Anonymous conversation access';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
