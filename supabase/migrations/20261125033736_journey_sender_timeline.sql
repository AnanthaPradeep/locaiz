-- A buyer can include their own quote decision in the chronological workspace.
-- The existing recipient-scoped notification query remains authoritative.
create policy journey_buyer_selection_read on public.journey_events
 for select to authenticated using (
   kind='Quote selected' and actor=(select auth.uid()) and sourcing_private.journey_side(thread_id)='buyer'
 );
