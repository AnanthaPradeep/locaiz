insert into public.sourcing_places(id,name,kind) values('journey-browser-place','Journey Browser Test','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values('30000000-0000-4000-8000-000000000010','Journey Browser Supplier','journey-browser-place',array['Artisan'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '30000000-0000-4000-8000-000000000010',id,'owner' from auth.users where email='seller-b@stock.example.com';
insert into public.stock_requests(id,buyer_id,submission_id,pilot_id,product_id,variant,quantity,expires_at,message)
 select '50000000-0000-4000-8000-000000000010',id,gen_random_uuid(),'nagercoil','audio-pads','Gift packaging',2,now()+interval '1 day','Pickup browser test'
 from auth.users where email='buyer-b@stock.example.com';
insert into public.stock_request_shops(id,request_id,business_id,shop_name,is_demo,status,price,currency,ready_at,available_quantity,responded_at,responded_by)
 select '60000000-0000-4000-8000-000000000010','50000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001',
 'Pilot Shop A',true,'available',100,'INR',now()+interval '1 minute',2,now(),id from auth.users where email='seller-a@stock.example.com';
insert into public.stock_shop_inventory(shop_id,product_id,variant,pilot_id,on_hand,enabled)
 values('00000000-0000-4000-8000-000000000001','audio-pads','Gift packaging','nagercoil',2,true);
insert into public.stock_pickup_windows(shop_id,product_id,variant,starts_at,ends_at,capacity)
 values('00000000-0000-4000-8000-000000000001','audio-pads','Gift packaging',now()+interval '1 hour',now()+interval '2 hours',2);
