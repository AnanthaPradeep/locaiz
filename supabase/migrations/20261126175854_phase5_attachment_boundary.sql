-- Keep existing attachment reads compatible with already stored paths.
alter policy journey_private_upload on storage.objects
 with check (
   bucket_id='journey-private'
   and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](pdf|jpeg|png|webp)$'
   and sourcing_private.journey_file_allowed(name,true)
 );
