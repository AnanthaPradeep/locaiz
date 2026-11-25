# LOCAIZ Phase 2

Buyer workspace is available through Connect and account navigation when the connected marketplace is enabled. Verified supplier passports and published product pages provide direct enquiry links. Seller Studio links to Seller enquiries. Purchase requirements can include private attachments and invite up to five verified suppliers.

Each invited business gets its own thread. Messages and revisions persist in Supabase. The authenticated browser subscribes to participant-visible events, with periodic refetch as a fallback. Notifications can be marked read in the conversation. Attachments use the private journey bucket and short-lived download links.

Comparison uses the same table and evaluation logic as Supplier Quote Comparison. It evaluates the requested quantity and destination and preserves the supplier's original currency. A total appears when applicable charges are resolved. Suppliers enter zero when a charge does not apply.

Quote selection alerts the supplier. The supplier confirms commercial terms before the buyer can create an order. Orders store the accepted revision and the original requirement, and the seller updates fulfillment from the conversation. Payment stays unrecorded.

Connected stock pilot shops can set inventory and pickup windows from assigned stock requests. Buyers can request pickup while a confirmation is valid. Shop approval checks both inventory and window capacity before placing a hold. The Stock Updates view includes reservation status changes.

## Run connected checks

Use the CI workflow as the reference for disposable Supabase setup and seeded accounts. CI applies the migrations, runs the SQL isolation and concurrency checks, loads the browser-only supplier fixture, and runs connected Playwright tests. In a public Pages build without connected settings, the workspace directs users to Demo Mode.
