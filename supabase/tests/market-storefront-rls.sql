begin;
insert into public.sourcing_places(id,name,kind) values ('storefront-test-place','Storefront test locality','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values ('31000000-0000-4000-8000-000000000001','Storefront test supplier','storefront-test-place',array['Artisan'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '31000000-0000-4000-8000-000000000001',id,'owner' from auth.users where email='seller-a@stock.example.com';

select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
insert into storage.objects(bucket_id,name) values ('market-storefronts','31000000-0000-4000-8000-000000000001/workshop.webp');
insert into public.market_storefronts(business_id,maker_story,workshop_path)
 values ('31000000-0000-4000-8000-000000000001','Seller supplied story','31000000-0000-4000-8000-000000000001/workshop.webp');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if exists(select 1 from public.market_storefronts where business_id='31000000-0000-4000-8000-000000000001')
  or exists(select 1 from storage.objects where bucket_id='market-storefronts')
 then raise exception 'Draft storefront leaked';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-b@stock.example.com'),true);
set local role authenticated;
do $$begin
 update public.market_storefronts set is_public=true where business_id='31000000-0000-4000-8000-000000000001';
 if found then raise exception 'Another business can publish the storefront';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
update public.market_storefronts set is_public=true where business_id='31000000-0000-4000-8000-000000000001';
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if not exists(select 1 from public.market_storefronts where business_id='31000000-0000-4000-8000-000000000001')
  or not exists(select 1 from storage.objects where bucket_id='market-storefronts')
 then raise exception 'Published storefront or linked workshop image unavailable';end if;
end $$;
rollback;
