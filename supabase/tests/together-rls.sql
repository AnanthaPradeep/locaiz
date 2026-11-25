begin;
insert into public.sourcing_places(id,name,kind) values('together-test-place','Together Test','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values('35000000-0000-4000-8000-000000000001','Together Supplier','together-test-place',array['Artisan'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '35000000-0000-4000-8000-000000000001',id,'owner' from auth.users where email='seller-a@stock.example.com';
insert into public.sourcing_products(id,name,category_id,owner_business_id,publication_state)
 values('market-together-test','Together Test Product','market-handmade','35000000-0000-4000-8000-000000000001','published');
insert into public.sourcing_variants(product_id,id,name) values('market-together-test','test','Test variant');
insert into public.sourcing_offers(id,product_id,variant_id,business_id,method,currency,unit_price_minor,minimum_quantity,published)
 values('35000000-0000-4000-8000-000000000002','market-together-test','test','35000000-0000-4000-8000-000000000001','Wholesale','INR',5000,2,true);
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.together_action('create',jsonb_build_object('id','35000000-0000-4000-8000-000000000003','offer','35000000-0000-4000-8000-000000000002','title','Together test group','minimum',4,'maximum',6,'closes',now()+interval '1 hour'));
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
select public.together_action('quantity','{"id":"35000000-0000-4000-8000-000000000003","quantity":4}');
select public.together_action('quantity','{"id":"35000000-0000-4000-8000-000000000003","quantity":4}');
do $$begin
 if not exists(select 1 from public.together_groups where id='35000000-0000-4000-8000-000000000003' and state='open' and pledged=4)
 then raise exception 'Group accepted automatically or double counted';end if;
 begin
  perform public.together_action('accept','{"id":"35000000-0000-4000-8000-000000000003"}');
  raise exception 'Buyer accepted group';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-b@stock.example.com'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.together_participation) then raise exception 'Buyer saw another account pledge';end if;
 begin
  perform public.together_action('quantity','{"id":"35000000-0000-4000-8000-000000000003","quantity":3}');
  raise exception 'Capacity exceeded';
 exception when raise_exception then if sqlerrm <> 'Group quantity limit reached' then raise;end if;end;
end $$;
select public.together_action('quantity','{"id":"35000000-0000-4000-8000-000000000003","quantity":2}');
select public.together_action('quantity','{"id":"35000000-0000-4000-8000-000000000003","quantity":0}');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.together_action('accept','{"id":"35000000-0000-4000-8000-000000000003"}');
do $$begin
 if not exists(select 1 from public.together_groups where id='35000000-0000-4000-8000-000000000003' and state='accepted' and pledged=4)
 then raise exception 'Group not accepted';end if;
end $$;
rollback;
