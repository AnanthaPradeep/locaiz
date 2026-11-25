
begin;
insert into public.stock_requests(id,buyer_id,submission_id,pilot_id,product_id,variant,quantity,expires_at)
 select '50000000-0000-4000-8000-000000000001',id,gen_random_uuid(),'nagercoil','studio-headphones','Standard',2,now()+interval '1 day'
 from auth.users where email='buyer-a@stock.example.com';
insert into public.stock_requests(id,buyer_id,submission_id,pilot_id,product_id,variant,quantity,expires_at)
 select '50000000-0000-4000-8000-000000000002',id,gen_random_uuid(),'nagercoil','studio-headphones','Standard',2,now()+interval '1 day'
 from auth.users where email='buyer-b@stock.example.com';
insert into public.stock_request_shops(id,request_id,business_id,shop_name,is_demo,status,price,currency,ready_at,available_quantity,responded_at,responded_by)
 select ('60000000-0000-4000-8000-00000000000'||right(r.id::text,1))::uuid,r.id,'00000000-0000-4000-8000-000000000001',
 'Pilot Shop A',true,'available',100,'INR',now()+interval '10 minutes',2,now(),u.id
 from public.stock_requests r cross join auth.users u where r.id::text like '50000000-%' and u.email='seller-a@stock.example.com';
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.pickup_action('inventory','{"assignment":"60000000-0000-4000-8000-000000000001","quantity":2,"enabled":true}');
select set_config('pickup_test.window',public.pickup_action('window',jsonb_build_object('assignment','60000000-0000-4000-8000-000000000001',
 'start',now()+interval '1 hour','end',now()+interval '2 hours','quantity',2))::text,true);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
select set_config('pickup_test.a',public.pickup_action('reserve',jsonb_build_object('assignment','60000000-0000-4000-8000-000000000001',
 'window',current_setting('pickup_test.window'),'quantity',2))::text,true);
do $$begin
 if not exists(select 1 from public.stock_reservations where id=current_setting('pickup_test.a')::uuid and status='requested')
  then raise exception 'Reservation was not merely requested'; end if;
 begin
  perform public.pickup_action('transition',jsonb_build_object('id',current_setting('pickup_test.a'),'state','approved'));
  raise exception 'Buyer self-approval allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-b@stock.example.com'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.stock_reservations where id=current_setting('pickup_test.a')::uuid)
  then raise exception 'Other buyer can see reservation'; end if;
end $$;
select set_config('pickup_test.b',public.pickup_action('reserve',jsonb_build_object('assignment','60000000-0000-4000-8000-000000000002',
 'window',current_setting('pickup_test.window'),'quantity',2))::text,true);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.pickup_action('transition',jsonb_build_object('id',current_setting('pickup_test.a'),'state','approved'));
do $$begin
 begin
  perform public.pickup_action('transition',jsonb_build_object('id',current_setting('pickup_test.b'),'state','approved'));
  raise exception 'Double reservation allowed';
 exception when raise_exception then
  if sqlerrm not like '%insufficient%' then raise; end if;
 end;
end $$;
select public.pickup_action('transition',jsonb_build_object('id',current_setting('pickup_test.a'),'state','ready'));
select public.pickup_action('transition',jsonb_build_object('id',current_setting('pickup_test.a'),'state','collected'));
do $$begin
 if (select on_hand from public.stock_shop_inventory where shop_id='00000000-0000-4000-8000-000000000001')<>0
  then raise exception 'Collection did not decrement inventory'; end if;
end $$;
rollback;
