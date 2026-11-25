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

insert into public.sourcing_products(id,name,category_id,owner_business_id,publication_state)
 values('market-bulk-browser','Browser Bulk Stoneware','market-handmade','30000000-0000-4000-8000-000000000010','published');
insert into public.sourcing_variants(product_id,id,name) values('market-bulk-browser','BOX-01','Stoneware box');
insert into public.sourcing_offers(id,product_id,variant_id,business_id,method,currency,unit_price_minor,minimum_quantity,published)
 values('33000000-0000-4000-8000-000000000001','market-bulk-browser','BOX-01','30000000-0000-4000-8000-000000000010','Wholesale','INR',100000,2,true);
insert into public.sourcing_price_tiers(offer_id,quantity,unit_price_minor)
 values('33000000-0000-4000-8000-000000000001',5,80000);
insert into public.journey_rfqs(id,buyer_id,submission,title,specifications,product_id,variant_id,quantity,unit,destination,currency)
 select '33000000-0000-4000-8000-000000000002',id,gen_random_uuid(),'Browser prior order','',
 'market-bulk-browser','BOX-01',5,'units','Chennai','INR' from auth.users where email='buyer-a@stock.example.com';
insert into public.journey_threads(id,rfq_id,business_id)
 values('33000000-0000-4000-8000-000000000003','33000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000010');
insert into public.journey_quote_revisions(id,thread_id,revision,currency,unit_minor,moq,production_days,delivery_supported,method,custom_terms,expires_at,created_by)
 select '33000000-0000-4000-8000-000000000004','33000000-0000-4000-8000-000000000003',1,'INR',65000,2,1,true,'shipping','',now()+interval '1 day',id from auth.users where email='seller-b@stock.example.com';
insert into public.journey_orders(id,thread_id,quote_id,buyer_id,business_id,terms,status)
 select '33000000-0000-4000-8000-000000000005','33000000-0000-4000-8000-000000000003','33000000-0000-4000-8000-000000000004',id,
 '30000000-0000-4000-8000-000000000010','{"requirement":{"product_id":"market-bulk-browser","variant_id":"BOX-01","quantity":5},"quote":{"currency":"INR","method":"shipping"},"appliedUnitMinor":65000,"totalMinor":325000,"estimatedDate":"2026-11-26"}','completed'
 from auth.users where email='buyer-a@stock.example.com';
