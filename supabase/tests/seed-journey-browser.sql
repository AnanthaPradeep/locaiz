insert into public.sourcing_places(id,name,kind) values('journey-browser-place','Journey Browser Test','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values('30000000-0000-4000-8000-000000000010','Journey Browser Supplier','journey-browser-place',array['Artisan'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '30000000-0000-4000-8000-000000000010',id,'owner' from auth.users where email='seller-b@stock.example.com';
