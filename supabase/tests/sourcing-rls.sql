begin;
insert into public.sourcing_places(id,name,kind) values ('qa-place','QA locality','Village');
insert into public.sourcing_categories(id,name) values ('qa-category','QA category');
insert into public.sourcing_products(id,name,category_id) values ('qa-product','QA product','qa-category');
insert into public.sourcing_variants(product_id,id,name) values ('qa-product','std','Standard');
insert into public.sourcing_businesses(id,name,base_id,roles)
values ('20000000-0000-4000-8000-000000000001','QA maker A','qa-place',array['Artisan']),
       ('20000000-0000-4000-8000-000000000002','QA maker B','qa-place',array['Artisan']);
insert into sourcing_private.members
select '20000000-0000-4000-8000-000000000001', id from auth.users where email = 'seller-a@stock.example.com';
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email='seller-a@stock.example.com'), true);
set local role authenticated;
insert into public.sourcing_offers(business_id,product_id,variant_id,method,currency,minimum_quantity)
values ('20000000-0000-4000-8000-000000000001','qa-product','std','Maker-direct','INR',1);
do $$
begin
  update public.sourcing_offers set minimum_quantity=2 where product_id='qa-product';
  if not found then raise exception 'Owner could not edit draft'; end if;
  begin
    insert into public.sourcing_offers(business_id,product_id,variant_id,method,currency,minimum_quantity)
    values ('20000000-0000-4000-8000-000000000002','qa-product','std','Maker-direct','INR',1);
    raise exception 'Cross-business insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.sourcing_offers set published=true where product_id='qa-product';
    raise exception 'Unreviewed publication allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email='seller-b@stock.example.com'), true);
set local role authenticated;
do $$
begin
  if exists(select 1 from public.sourcing_offers where product_id='qa-product') then
    raise exception 'Another seller can read an unpublished offer';
  end if;
  update public.sourcing_offers set minimum_quantity=5 where product_id='qa-product';
  if found then raise exception 'Another seller can edit an offer'; end if;
end;
$$;
set local role anon;
do $$
begin
  if exists(select 1 from public.sourcing_offers where product_id='qa-product') then
    raise exception 'Anonymous user can read an unpublished offer';
  end if;
end;
$$;
rollback;
