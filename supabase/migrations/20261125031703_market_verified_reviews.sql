create table public.market_reviews (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.journey_orders,
 buyer_id uuid not null references auth.users,
 business_id uuid not null references public.sourcing_businesses,
 product_id text references public.sourcing_products,
 target text not null check (target in ('product','supplier')),
 rating smallint not null check (rating between 1 and 5),
 body text not null check (char_length(trim(body)) between 10 and 2000),
 state text not null default 'pending' check (state in ('pending','published','hidden')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(order_id,target),
 check ((target='product')=(product_id is not null))
);
create index market_reviews_public_subject on public.market_reviews(business_id,target,product_id,created_at desc) where state='published';
create index market_reviews_pending on public.market_reviews(created_at) where state='pending';
create table public.market_review_audit (
 id bigint generated always as identity primary key,
 review_id uuid not null references public.market_reviews,
 actor uuid not null references auth.users,
 action text not null check (action in ('submitted','edited','published','hidden','reported')),
 note text not null default '',
 created_at timestamptz not null default now()
);
create unique index market_review_report_once on public.market_review_audit(review_id,actor) where action='reported';
create index market_review_audit_review on public.market_review_audit(review_id,id);
alter table public.market_reviews enable row level security;
alter table public.market_review_audit enable row level security;
revoke all on public.market_reviews,public.market_review_audit from public,anon,authenticated;
grant select(id,business_id,product_id,target,rating,body,state,created_at,updated_at) on public.market_reviews to anon,authenticated;
grant select(id,review_id,action,note,created_at) on public.market_review_audit to authenticated;
create policy market_review_public on public.market_reviews for select to anon,authenticated using (
 state='published' and exists(select 1 from public.sourcing_businesses b where b.id=business_id and b.published and b.trust_state='verified')
);
create policy market_review_operator on public.market_reviews for select to authenticated using ((select sourcing_private.is_operator()));
create policy market_review_audit_operator on public.market_review_audit for select to authenticated using ((select sourcing_private.is_operator()));

create function sourcing_private.review_action(command text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor_id uuid:=auth.uid();
 key_id uuid:=nullif(payload->>'id','')::uuid;
 requested_target text:=payload->>'target';
 review_row public.market_reviews;
 order_row public.journey_orders;
 product_key text;
 reason text:=trim(coalesce(payload->>'reason',''));
 review_state text:=payload->>'state';
 previous_id uuid;
begin
 if actor_id is null or not exists(select 1 from auth.users where id=actor_id and email_confirmed_at is not null)
 then raise exception 'Verified account required' using errcode='42501';end if;
 if command in ('own','save') then
   select * into order_row from public.journey_orders where id=key_id and buyer_id=actor_id and status='completed' for share;
   if not found or sourcing_private.market_role(order_row.business_id) is not null
     then raise exception 'A qualifying completed purchase is required' using errcode='42501';end if;
   if command='own' then
     return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'target',r.target,'rating',r.rating,'body',r.body,'state',r.state)) from public.market_reviews r where r.order_id=key_id),'[]');
   end if;
   if requested_target='product' then
     product_key:=order_row.terms#>>'{requirement,product_id}';
     if product_key is null then raise exception 'This order has no reviewable product';end if;
   elsif requested_target is distinct from 'supplier' then raise exception 'Invalid review type';
   end if;
   perform pg_advisory_xact_lock(hashtextextended(key_id::text||requested_target,0));
   select id into previous_id from public.market_reviews where order_id=key_id and target=requested_target;
   insert into public.market_reviews(order_id,buyer_id,business_id,product_id,target,rating,body)
   values(key_id,actor_id,order_row.business_id,product_key,requested_target,(payload->>'rating')::smallint,trim(payload->>'body'))
   on conflict(order_id,target) do update set rating=excluded.rating,body=excluded.body,state='pending',updated_at=now()
   returning * into review_row;
   insert into public.market_review_audit(review_id,actor,action) values(review_row.id,actor_id,case when previous_id is null then 'submitted' else 'edited' end);
 elsif command='moderate' then
   if not sourcing_private.is_operator() then raise exception 'Review moderator required' using errcode='42501';end if;
   if review_state is null or review_state not in ('published','hidden') or char_length(reason) not between 10 and 1000
     then raise exception 'A moderation decision and reason are required';end if;
   select * into review_row from public.market_reviews where id=key_id for update;
   if not found then raise exception 'Review unavailable';end if;
   if review_state='published' and not exists(select 1 from public.journey_orders o where o.id=review_row.order_id and o.status='completed')
     then raise exception 'Order no longer qualifies';end if;
   update public.market_reviews set state=review_state,updated_at=now() where id=key_id;
   insert into public.market_review_audit(review_id,actor,action,note) values(key_id,actor_id,review_state,reason);
 elsif command='report' then
   select * into review_row from public.market_reviews where id=key_id and state='published' and exists(
     select 1 from public.sourcing_businesses b where b.id=business_id and b.published and b.trust_state='verified');
   if not found or char_length(reason) not between 10 and 1000 then raise exception 'Review and report reason are required';end if;
   insert into public.market_review_audit(review_id,actor,action,note) values(key_id,actor_id,'reported',reason)
   on conflict do nothing;
 else raise exception 'Unknown review action';
 end if;
 return jsonb_build_object('id',review_row.id);
end;
$$;
create function public.market_review_action(command text,payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select sourcing_private.review_action(command,payload); $$;
revoke all on function public.market_review_action(text,jsonb),sourcing_private.review_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.market_review_action(text,jsonb),sourcing_private.review_action(text,jsonb) to authenticated;

create function public.market_review_summary(subject_business uuid,subject_product text) returns table(review_count bigint,average_rating numeric)
language sql stable security invoker set search_path='' as $$
 select count(*),round(avg(rating),1) from public.market_reviews
 where state='published' and business_id=subject_business and product_id is not distinct from subject_product;
$$;
revoke all on function public.market_review_summary(uuid,text) from public,anon,authenticated;
grant execute on function public.market_review_summary(uuid,text) to anon,authenticated;
