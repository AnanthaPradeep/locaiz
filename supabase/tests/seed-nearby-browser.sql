insert into public.stock_businesses(id,pilot_id,name,active,is_demo)
 values ('34000000-0000-4000-8000-000000000010','nagercoil','Browser Stock Location',true,false);
insert into public.sourcing_places(id,name,kind) values ('nearby-browser-place','Kottar','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published,pilot_business_id)
 values ('34000000-0000-4000-8000-000000000011','Verified Browser Shop','nearby-browser-place',array['Retailer'],'verified',true,'34000000-0000-4000-8000-000000000010');
insert into public.market_locations(id,business_id,locality,country_code,pickup,latitude,longitude,opening_hours,verified_at)
 values ('34000000-0000-4000-8000-000000000012','34000000-0000-4000-8000-000000000011','Kottar','IN',true,8.178,77.437,'09:00 to 18:00',now());
