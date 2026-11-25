alter table public.market_locations
 add column latitude double precision check (latitude between -90 and 90),
 add column longitude double precision check (longitude between -180 and 180),
 add column opening_hours text not null default '' check (char_length(opening_hours)<=500),
 add column verified_at timestamptz,
 add constraint market_location_verified_coordinates check (
   (verified_at is null and latitude is null and longitude is null)
   or (verified_at is not null and latitude is not null and longitude is not null)
 );
create index market_locations_verified on public.market_locations(locality) where verified_at is not null;

create function sourcing_private.verify_nearby_location(target uuid, lat double precision, lng double precision, hours text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not sourcing_private.is_operator()
   then raise exception 'Trust operator permission required' using errcode='42501';end if;
 if lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180
   then raise exception 'Provide coordinates for the verified shop location';end if;
 update public.market_locations location set latitude=lat,longitude=lng,opening_hours=trim(coalesce(hours,'')),verified_at=now()
 where location.id=target and exists(
   select 1 from public.sourcing_businesses b join public.stock_businesses shop on shop.id=b.pilot_business_id
   where b.id=location.business_id and b.published and b.trust_state='verified' and shop.active and not shop.is_demo
 );
 if not found then raise exception 'Location must belong to a verified participating shop';end if;
 return target;
end;
$$;
create function public.verify_nearby_location(target uuid, lat double precision, lng double precision, hours text) returns uuid
language sql security invoker set search_path='' as $$ select sourcing_private.verify_nearby_location(target,lat,lng,hours); $$;
revoke all on function public.verify_nearby_location(uuid,double precision,double precision,text),
 sourcing_private.verify_nearby_location(uuid,double precision,double precision,text) from public,anon,authenticated;
grant execute on function public.verify_nearby_location(uuid,double precision,double precision,text),
 sourcing_private.verify_nearby_location(uuid,double precision,double precision,text) to authenticated;
