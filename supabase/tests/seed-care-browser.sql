insert into public.sourcing_places(id,name,kind) values('care-browser-place','Care browser locality','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values('37000000-0000-4000-8000-000000000010','Browser Care Service','care-browser-place',array['Service provider'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '37000000-0000-4000-8000-000000000010',id,'owner' from auth.users where email='seller-b@stock.example.com';
