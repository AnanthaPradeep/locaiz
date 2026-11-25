begin;
insert into public.sourcing_places(id,name,kind) values('insights-test-place','Insights Test','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values('36000000-0000-4000-8000-000000000001','Insights Supplier','insights-test-place',array['Artisan'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '36000000-0000-4000-8000-000000000001',id,'owner' from auth.users where email='seller-a@stock.example.com';
insert into public.sourcing_products(id,name,category_id,owner_business_id,publication_state)
 values('market-insights-test','Insights Test Product','market-handmade','36000000-0000-4000-8000-000000000001','published');
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
select public.record_product_view('market-insights-test');
select public.record_product_view('market-insights-test');
select public.record_product_view('unavailable-product');
select public.record_search_page(array['market-insights-test','market-insights-test','unavailable-product']);
select public.record_search_page(array['market-insights-test']);
do $$begin
 begin
   perform public.seller_demand('36000000-0000-4000-8000-000000000001');
   raise exception 'Buyer saw seller analytics';
 exception when insufficient_privilege then null;end;
 begin
   perform public.seller_insights('36000000-0000-4000-8000-000000000001');
   raise exception 'Buyer saw seller activity';
 exception when insufficient_privilege then null;end;
 begin
   perform count(*) from sourcing_private.product_view_events;
   raise exception 'Buyer saw private events';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.record_product_view('market-insights-test');
do $$declare outcome jsonb;
begin
 outcome:=public.seller_insights('36000000-0000-4000-8000-000000000001');
 if (outcome->>'productViews')::int<>1 or (outcome->>'rfqs')::int<>0 or outcome->>'responseHours' is not null
   then raise exception 'Incorrect view deduplication or empty-data handling: %',outcome;end if;
 outcome:=public.seller_demand('36000000-0000-4000-8000-000000000001');
 if (outcome->>'searchImpressions')::int<>1 or outcome->>'pickupConversion' is not null
   or jsonb_array_length(outcome->'categories')<>0 then raise exception 'Invalid or disclosed demand aggregate: %',outcome;end if;
end $$;
rollback;
