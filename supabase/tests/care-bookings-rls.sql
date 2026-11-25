begin;
insert into public.sourcing_places(id,name,kind) values('care-test','Care Test','Locality');
insert into public.sourcing_businesses(id,name,base_id,roles,trust_state,published)
 values('37000000-0000-4000-8000-000000000001','Care Provider','care-test',array['Service provider'],'verified',true);
insert into sourcing_private.members(business_id,user_id,member_role)
 select '37000000-0000-4000-8000-000000000001',id,'owner' from auth.users where email='seller-a@stock.example.com';
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.care_action('publish','{"id":"37000000-0000-4000-8000-000000000002","service":"37000000-0000-4000-8000-000000000001","title":"Care fixture","category":"Repair","coverage":"Chennai","description":"Appointment estimate after assessment.","currency":"INR"}');
select public.care_action('slot',jsonb_build_object('id','37000000-0000-4000-8000-000000000003','service','37000000-0000-4000-8000-000000000002','start',now()+interval '1 hour','end',now()+interval '2 hours'));
select public.care_action('slot',jsonb_build_object('id','37000000-0000-4000-8000-000000000004','service','37000000-0000-4000-8000-000000000002','start',now()+interval '3 hours','end',now()+interval '4 hours'));
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
select public.care_action('request','{"id":"37000000-0000-4000-8000-000000000005","service":"37000000-0000-4000-8000-000000000002","slot":"37000000-0000-4000-8000-000000000003","note":"Private fixture"}');
select public.care_action('message','{"id":"37000000-0000-4000-8000-000000000005","requestKey":"37000000-0000-4000-8000-000000000006","body":"Private appointment detail"}');
select public.care_action('message','{"id":"37000000-0000-4000-8000-000000000005","requestKey":"37000000-0000-4000-8000-000000000006","body":"Private appointment detail"}');
do $$begin
 if (select count(id) from public.care_messages)<>1 then raise exception 'Booking message duplicated';end if;
 begin
  perform public.care_action('transition','{"id":"37000000-0000-4000-8000-000000000005","state":"accepted"}');
  raise exception 'Buyer approved own appointment';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-b@stock.example.com'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.care_bookings) or exists(select id from public.care_messages) then raise exception 'Private Care data leaked';end if;
 begin
  perform public.care_action('request','{"id":"37000000-0000-4000-8000-000000000007","service":"37000000-0000-4000-8000-000000000002","slot":"37000000-0000-4000-8000-000000000003"}');
  raise exception 'Double booking allowed';
 exception when raise_exception then if sqlerrm<>'Appointment is unavailable' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
select public.care_action('reschedule','{"id":"37000000-0000-4000-8000-000000000005","slot":"37000000-0000-4000-8000-000000000004"}');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='seller-a@stock.example.com'),true);
set local role authenticated;
select public.care_action('transition','{"id":"37000000-0000-4000-8000-000000000005","state":"accepted"}');
reset role;
update public.care_slots set starts_at=now()-interval '1 hour' where id='37000000-0000-4000-8000-000000000004';
set local role authenticated;
select public.care_action('transition','{"id":"37000000-0000-4000-8000-000000000005","state":"in_service"}');
select public.care_action('transition','{"id":"37000000-0000-4000-8000-000000000005","state":"completed"}');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='buyer-a@stock.example.com'),true);
set local role authenticated;
select public.care_action('review','{"id":"37000000-0000-4000-8000-000000000005","rating":5}');
do $$begin
 if not exists(select 1 from public.care_slots where id='37000000-0000-4000-8000-000000000003' and not taken)
   or not exists(select 1 from public.care_bookings where status='completed' and rating=5)
 then raise exception 'Reschedule or completion did not persist';end if;
end $$;
rollback;
