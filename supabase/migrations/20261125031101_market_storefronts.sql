create table public.market_storefronts (
  business_id uuid primary key references public.sourcing_businesses on delete cascade,
  maker_story text not null default '' check (char_length(maker_story)<=3000),
  materials text not null default '' check (char_length(materials)<=1500),
  production_capacity text not null default '' check (char_length(production_capacity)<=500),
  cover_path text,
  logo_path text,
  workshop_path text,
  is_public boolean not null default false,
  check (cover_path is null or split_part(cover_path,'/',1)=business_id::text),
  check (logo_path is null or split_part(logo_path,'/',1)=business_id::text),
  check (workshop_path is null or split_part(workshop_path,'/',1)=business_id::text)
);
alter table public.market_storefronts enable row level security;
revoke all on public.market_storefronts from anon,authenticated,public;
grant select on public.market_storefronts to anon,authenticated;
grant insert,update on public.market_storefronts to authenticated;
create policy storefront_public_read on public.market_storefronts
 for select to anon,authenticated using (
  is_public and exists (select 1 from public.sourcing_businesses b
    where b.id=business_id and b.published and b.trust_state='verified')
 );
create policy storefront_owner_read on public.market_storefronts
 for select to authenticated using (sourcing_private.can_manage(business_id));
create policy storefront_owner_insert on public.market_storefronts
 for insert to authenticated with check (sourcing_private.can_manage(business_id));
create policy storefront_owner_update on public.market_storefronts
 for update to authenticated using (sourcing_private.can_manage(business_id))
 with check (sourcing_private.can_manage(business_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('market-storefronts','market-storefronts',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy storefront_upload on storage.objects for insert to authenticated with check (
 bucket_id='market-storefronts' and exists (
   select 1 from public.sourcing_businesses b where b.id::text=split_part(storage.objects.name,'/',1)
     and sourcing_private.can_manage(b.id)
 )
);
create policy storefront_shop_media on storage.objects for select to anon,authenticated using (
 bucket_id='market-storefronts' and exists (
   select 1 from public.market_storefronts page
   where page.business_id::text=split_part(storage.objects.name,'/',1)
     and storage.objects.name in (page.cover_path,page.logo_path,page.workshop_path)
 )
);
create policy storefront_owner_media on storage.objects for select to authenticated using (
 bucket_id='market-storefronts' and exists (
   select 1 from public.sourcing_businesses b where b.id::text=split_part(storage.objects.name,'/',1)
     and sourcing_private.can_manage(b.id)
 )
);

