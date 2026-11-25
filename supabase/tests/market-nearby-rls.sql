begin;
insert into public.stock_businesses(id,pilot_id,name,active,is_demo)
 values ('34000000-0000-4000-8000-000000000001','nagercoil','Local test stock shop',true,false);
insert into public.sourcing_places(id,name,kind) values ('nearby-test-place','Nearby test locality','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published,pilot_business_id)
 values ('34000000-0000-4000-8000-000000000002','Nearby test supplier','nearby-test-place',array['Retailer'],'verified',true,'34000000-0000-4000-8000-000000000001');
insert into public.market_locations(id,business_id,locality,country_code,pickup)
 values ('34000000-0000-4000-8000-000000000003','34000000-0000-4000-8000-000000000002','Nearby test locality','IN',true);
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
do $$begin
 begin
  perform public.verify_nearby_location('34000000-0000-4000-8000-000000000003',8.17,77.43,'09:00 to 18:00');
  raise exception 'Buyer verified a shop location';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-c@stock.example.com'),true);
set local role authenticated;
select public.verify_nearby_location('34000000-0000-4000-8000-000000000003',8.17,77.43,'09:00 to 18:00');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if not exists(select 1 from public.market_locations where id='34000000-0000-4000-8000-000000000003' and verified_at is not null and opening_hours='09:00 to 18:00')
   then raise exception 'Verified location is unavailable';end if;
end $$;
rollback;
