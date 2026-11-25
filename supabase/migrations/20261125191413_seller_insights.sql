create table sourcing_private.product_view_events(
 viewer_id uuid not null references auth.users on delete cascade,
 product_id text not null references public.sourcing_products on delete cascade,
 business_id uuid not null references public.sourcing_businesses on delete cascade,
 bucket timestamptz not null,
 primary key(viewer_id,product_id,bucket)
);
create index product_views_business_window on sourcing_private.product_view_events(business_id,bucket);
create index product_views_actor_window on sourcing_private.product_view_events(viewer_id,bucket);
revoke all on sourcing_private.product_view_events from public,anon,authenticated;
alter table sourcing_private.product_view_events enable row level security;

create function sourcing_private.record_product_view(product text) returns void
language plpgsql security definer set search_path='' as $$
declare
 viewer uuid:=auth.uid();
 owner_id uuid;
 hour_bucket timestamptz:=date_trunc('hour',statement_timestamp(),'UTC');
begin
 if viewer is null then return;end if;
 select p.owner_business_id into owner_id from public.sourcing_products p
 join public.sourcing_businesses b on b.id=p.owner_business_id
 where p.id=product and p.publication_state='published' and b.published and b.trust_state='verified';
 if owner_id is null or sourcing_private.market_role(owner_id) is not null then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(viewer::text,4194));
 if (select count(*) from sourcing_private.product_view_events e where e.viewer_id=viewer and e.bucket=hour_bucket)>=60 then return;end if;
 insert into sourcing_private.product_view_events(viewer_id,product_id,business_id,bucket)
 values(viewer,product,owner_id,hour_bucket) on conflict do nothing;
end;
$$;
create function public.record_product_view(product text) returns void
language sql security invoker set search_path='' as $$ select sourcing_private.record_product_view(product); $$;

create function sourcing_private.seller_insights(business uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 started timestamptz:=now()-interval '30 days';
 result jsonb;
begin
 if auth.uid() is null or not sourcing_private.can_manage(business) then
  raise exception 'Managed business required' using errcode='42501';end if;
 with threads as (
   select t.id,t.rfq_id,t.selected_quote,r.created_at,r.product_id,r.buyer_id from public.journey_threads t
   join public.journey_rfqs r on r.id=t.rfq_id where t.business_id=business and r.created_at>=started
 ), quotes as (
   select q.id,q.thread_id,q.created_at from public.journey_quote_revisions q join threads t on t.id=q.thread_id
 ), first_response as (
   select t.id,extract(epoch from min(response.sent)-t.created_at)/3600 as hours
   from threads t join lateral (
     select min(created_at) as sent from public.journey_messages where thread_id=t.id and side='seller'
     union all select min(created_at) from quotes q where q.thread_id=t.id
   ) response on response.sent is not null group by t.id,t.created_at
 ), orders as (
   select o.status,o.buyer_id from public.journey_orders o where o.business_id=business and o.created_at>=started
 ), repeats as (
   select buyer_id from orders where status='completed' group by buyer_id having count(*)>1
 )
 select jsonb_build_object(
   'productViews',(select count(*) from sourcing_private.product_view_events e where e.business_id=business and e.bucket>=started),
   'enquiries',(select count(*) from threads where product_id is not null),
   'rfqs',(select count(*) from threads),
   'responseHours',(select case when count(*)>=5 then round(avg(hours),1) end from first_response),
   'quoteSubmissions',(select count(*) from quotes),
   'quoteSelectionRate',(select case when count(*)>=5 then round(100.0*count(selected_quote)/count(*),1) end
      from threads t where exists(select 1 from quotes q where q.thread_id=t.id)),
   'orders',(select count(*) from orders),
   'completed',(select count(*) from orders where status='completed'),
   'repeatBuyers',(select case when count(distinct buyer_id)>=5 then (select count(*) from repeats) end from orders where status='completed')
 ) into result;
 return result;
end;
$$;
create function public.seller_insights(business uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select sourcing_private.seller_insights(business); $$;
revoke all on function public.record_product_view(text),sourcing_private.record_product_view(text),
 public.seller_insights(uuid),sourcing_private.seller_insights(uuid) from public,anon,authenticated;
grant execute on function public.record_product_view(text),sourcing_private.record_product_view(text),
 public.seller_insights(uuid),sourcing_private.seller_insights(uuid) to authenticated;
