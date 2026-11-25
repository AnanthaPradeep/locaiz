
begin;
insert into sourcing_private.operators select id from auth.users where email='seller-c@stock.example.com';
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select set_config('market_test.business',public.market_action('create_business',
 '{"name":"Marketplace QA A","city":"Nagercoil","country":"IN","type":"Artisan","capabilities":["Wholesale"]}'),true);
select set_config('market_test.second',public.market_action('create_business',
 '{"name":"Marketplace QA B","city":"Chennai","country":"IN","type":"Workshop"}'),true);
select set_config('market_test.listing',public.market_action('save_listing',jsonb_build_object(
 'business',current_setting('market_test.business'),'name','Private test lamp','category','market-handmade',
 'sku','LAMP','variant','Standard','method','Maker-direct','currency','INR','price',125000,'moq',2,
 'quantity',12,'tiers','[{"quantity":5,"minor":110000}]'::jsonb)),true);
select set_config('market_test.invitation',public.market_action('invite',jsonb_build_object(
 'business',current_setting('market_test.business'),'email','seller-b@stock.example.com','role','catalogue')),true);
do $$
begin
 if jsonb_array_length(public.market_context()->'businesses') <> 2 then raise exception 'Owner scope missing'; end if;
 begin
  perform public.market_action('review_listing',jsonb_build_object('target',current_setting('market_test.listing'),'decision','published'));
  raise exception 'Owner could self-publish';
 exception when insufficient_privilege then null;
 end;
end $$;
select public.market_action('inventory',jsonb_build_object('business',current_setting('market_test.business'),
 'target',current_setting('market_test.listing'),'sku','LAMP','quantity',4));
select public.market_action('listing_state',jsonb_build_object('business',current_setting('market_test.business'),
 'target',current_setting('market_test.listing'),'decision','submitted'));
select set_config('market_test.supplier_review',public.market_action('verify_request',jsonb_build_object(
 'business',current_setting('market_test.business'),'summary','Structured operator test')),true);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
do $$
begin
 if exists(select 1 from public.sourcing_products where id=current_setting('market_test.listing')) then raise exception 'Buyer read a submitted product'; end if;
 begin
  perform public.market_action('accept_invite',jsonb_build_object('target',current_setting('market_test.invitation')));
  raise exception 'Wrong account accepted an invite';
 exception when insufficient_privilege then null;
 end;
 if exists(select 1 from public.market_verifications where id=current_setting('market_test.supplier_review')::uuid)
   then raise exception 'Buyer read private verification'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-b@stock.example.com'),true);
set local role authenticated;
do $$
begin
 if exists(select 1 from public.market_inventory where product_id=current_setting('market_test.listing')) then raise exception 'Cross-business inventory read'; end if;
 begin
  perform public.market_action('inventory',jsonb_build_object('business',current_setting('market_test.business'),
    'target',current_setting('market_test.listing'),'sku','LAMP','quantity',9));
  raise exception 'Cross-business inventory update';
 exception when insufficient_privilege then null;
 end;
end $$;
select public.market_action('accept_invite',jsonb_build_object('target',current_setting('market_test.invitation')));
do $$
begin
 if not exists(select 1 from public.market_inventory where product_id=current_setting('market_test.listing') and quantity=4) then raise exception 'Team member inventory is unavailable'; end if;
 begin
  perform public.market_action('invite',jsonb_build_object('business',current_setting('market_test.business'),'email','buyer-a@stock.example.com','role','manager'));
  raise exception 'Catalogue staff could invite managers';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$
begin
 if exists(select 1 from public.sourcing_products where id=current_setting('market_test.listing')) then raise exception 'Draft leak'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-c@stock.example.com'),true);
set local role authenticated;
select public.market_action('review_supplier',jsonb_build_object('target',current_setting('market_test.supplier_review'),'decision','verified'));
select public.market_action('review_listing',jsonb_build_object('target',current_setting('market_test.listing'),'decision','under_review'));
select public.market_action('review_listing',jsonb_build_object('target',current_setting('market_test.listing'),'decision','published'));
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$
begin
 if not exists(select 1 from public.sourcing_offers where product_id=current_setting('market_test.listing') and published)
 then raise exception 'Published offer is hidden'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.market_action('listing_state',jsonb_build_object('business',current_setting('market_test.business'),
 'target',current_setting('market_test.listing'),'decision','archived'));
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$
begin
 if exists(select 1 from public.sourcing_products where id=current_setting('market_test.listing')) then raise exception 'Archived product leak'; end if;
end $$;
rollback;
