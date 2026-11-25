-- A buyer retains access to the selected window's times after the confirmation expires.
create policy stock_reserved_window_read on public.stock_pickup_windows
 for select to authenticated using (
   exists(select 1 from public.stock_reservations r
          where r.window_id=stock_pickup_windows.id and r.buyer_id=(select auth.uid()))
 );
