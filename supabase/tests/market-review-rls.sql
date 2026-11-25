begin;
insert into public.sourcing_places(id,name,kind) values ('review-test','Review test locality','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values ('32000000-0000-4000-8000-000000000001','Review test supplier','review-test',array['Artisan'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '32000000-0000-4000-8000-000000000001',id,'owner' from auth.users where email='seller-a@stock.example.com';
insert into public.journey_rfqs(id,buyer_id,submission,title,specifications,quantity,unit,destination,currency)
 select '32000000-0000-4000-8000-000000000002',id,gen_random_uuid(),'Review fixture','',1,'units','Chennai','INR' from auth.users where email='buyer-a@stock.example.com';
insert into public.journey_threads(id,rfq_id,business_id)
 values ('32000000-0000-4000-8000-000000000003','32000000-0000-4000-8000-000000000002','32000000-0000-4000-8000-000000000001');
insert into public.journey_quote_revisions(id,thread_id,revision,currency,unit_minor,moq,production_days,delivery_supported,method,custom_terms,expires_at,created_by)
 select '32000000-0000-4000-8000-000000000004','32000000-0000-4000-8000-000000000003',1,'INR',10000,1,1,true,'pickup','',now()+interval '1 day',id from auth.users where email='seller-a@stock.example.com';
insert into public.journey_orders(id,thread_id,quote_id,buyer_id,business_id,terms)
 select '32000000-0000-4000-8000-000000000005','32000000-0000-4000-8000-000000000003','32000000-0000-4000-8000-000000000004',id,
 '32000000-0000-4000-8000-000000000001','{}' from auth.users where email='buyer-a@stock.example.com';

select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
do $$begin
 begin
  perform public.market_review_action('save','{"id":"32000000-0000-4000-8000-000000000005","target":"supplier","rating":4,"body":"Verified fixture review"}');
  raise exception 'Uncompleted review allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.journey_orders set status='completed' where id='32000000-0000-4000-8000-000000000005';
set local role authenticated;
select set_config('review_test.id',public.market_review_action('save','{"id":"32000000-0000-4000-8000-000000000005","target":"supplier","rating":4,"body":"Verified fixture review"}')->>'id',true);
select public.market_review_action('save','{"id":"32000000-0000-4000-8000-000000000005","target":"supplier","rating":5,"body":"Edited fixture review"}');
do $$begin
 if jsonb_array_length(public.market_review_action('own','{"id":"32000000-0000-4000-8000-000000000005"}'))<>1
   then raise exception 'Duplicate review created';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if (select review_count from public.market_review_summary('32000000-0000-4000-8000-000000000001',null))<>0
  then raise exception 'Pending review included in public rating';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-c@stock.example.com'),true);
set local role authenticated;
select public.market_review_action('moderate',jsonb_build_object('id',current_setting('review_test.id'),'state','published','reason','Moderation test approval'));
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if (select average_rating from public.market_review_summary('32000000-0000-4000-8000-000000000001',null)) is distinct from 5.0
  then raise exception 'Approved review missing from public rating';end if;
end $$;
rollback;
