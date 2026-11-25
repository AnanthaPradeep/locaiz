create table sourcing_private.product_search_impressions(
 viewer_id uuid not null references auth.users on delete cascade,
 product_id text not null references public.sourcing_products on delete cascade,
 business_id uuid not null references public.sourcing_businesses on delete cascade,
 bucket timestamptz not null,
 primary key(viewer_id,product_id,bucket)
);
create index search_impressions_business_window on sourcing_private.product_search_impressions(business_id,bucket);
create index search_impressions_actor_window on sourcing_private.product_search_impressions(viewer_id,bucket);
revoke all on sourcing_private.product_search_impressions from public,anon,authenticated;
alter table sourcing_private.product_search_impressions enable row level security;

create function sourcing_private.record_search_page(products text[]) returns void
language plpgsql security definer set search_path='' as $$
declare
 viewer uuid:=auth.uid();
 hour_bucket timestamptz:=date_trunc('hour',statement_timestamp(),'UTC');
 remaining int;
begin
 if viewer is null or coalesce(cardinality(products),0) not between 1 and 8
   or exists(select 1 from unnest(products) value where value is null or char_length(value)>120)
 then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(viewer::text,4195));
 select greatest(120-count(*),0) into remaining
 from sourcing_private.product_search_impressions e where e.viewer_id=viewer and e.bucket=hour_bucket;
 if remaining=0 then return;end if;
 insert into sourcing_private.product_search_impressions(viewer_id,product_id,business_id,bucket)
 select viewer,p.id,p.owner_business_id,hour_bucket
 from public.sourcing_products p join public.sourcing_businesses b on b.id=p.owner_business_id
 where p.id=any(products) and p.publication_state='published' and b.published and b.trust_state='verified'
   and sourcing_private.market_role(b.id) is null
   and not exists(select 1 from sourcing_private.product_search_impressions e where e.viewer_id=viewer and e.product_id=p.id and e.bucket=hour_bucket)
 order by p.id limit remaining on conflict do nothing;
end;
$$;
create function public.record_search_page(products text[]) returns void
language sql security invoker set search_path='' as $$ select sourcing_private.record_search_page(products); $$;

create function sourcing_private.seller_demand(business uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 started timestamptz:=now()-interval '30 days';
 result jsonb;
begin
 if auth.uid() is null or not sourcing_private.can_manage(business) then
  raise exception 'Managed business required' using errcode='42501';end if;
 with demand as (
   select r.id,r.quantity,r.product_id,r.buyer_id,t.latest_quote,t.invite_state,
     case when trim(r.destination) ~ '^[A-Za-z]{2}$' then upper(trim(r.destination)) end as country
   from public.journey_threads t join public.journey_rfqs r on r.id=t.rfq_id
   where t.business_id=business and r.created_at>=started
 ), categories as (
   select c.name as label,count(*) as requests from demand d
   join public.sourcing_products p on p.id=d.product_id join public.sourcing_categories c on c.id=p.category_id
   group by c.name having count(distinct d.buyer_id)>=5 order by requests desc,c.name limit 5
 ), quantity_bands as (
   select case when quantity<=10 then '1-10' when quantity<=100 then '11-100'
         when quantity<=1000 then '101-1,000' else '1,001+' end as label,count(*) as requests
   from demand group by 1 having count(distinct buyer_id)>=5 order by requests desc,label
 ), regions as (
   select country as label,count(*) as requests from demand
   where exists(select 1 from public.sourcing_places p where p.country_code=demand.country)
   group by country having count(distinct buyer_id)>=5 order by requests desc,country limit 5
 ), stock as (
   select a.id,r.buyer_id from public.stock_request_shops a
   join public.stock_requests r on r.id=a.request_id
   join public.sourcing_businesses b on b.pilot_business_id=a.business_id
   where b.id=business and r.created_at>=started and a.status='available'
 )
 select jsonb_build_object(
  'searchImpressions',(select count(*) from sourcing_private.product_search_impressions e where e.business_id=business and e.bucket>=started),
  'unquotedRequests',(select case when count(distinct buyer_id)>=5 then count(*) end from demand where latest_quote is null and invite_state<>'declined'),
  'pickupConversion',(select case when count(distinct buyer_id)>=5 then round(100.0*count(*) filter(where exists(
    select 1 from public.stock_reservations held where held.assignment_id=stock.id and held.status='collected'))/count(*),1) end from stock),
  'categories',coalesce((select jsonb_agg(to_jsonb(categories) order by requests desc,label) from categories),'[]'),
  'quantities',coalesce((select jsonb_agg(to_jsonb(quantity_bands) order by requests desc,label) from quantity_bands),'[]'),
  'regions',coalesce((select jsonb_agg(to_jsonb(regions) order by requests desc,label) from regions),'[]')
 ) into result;
 return result;
end;
$$;
create function public.seller_demand(business uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select sourcing_private.seller_demand(business); $$;
revoke all on function public.record_search_page(text[]),sourcing_private.record_search_page(text[]),
 public.seller_demand(uuid),sourcing_private.seller_demand(uuid) from public,anon,authenticated;
grant execute on function public.record_search_page(text[]),sourcing_private.record_search_page(text[]),
 public.seller_demand(uuid),sourcing_private.seller_demand(uuid) to authenticated;
