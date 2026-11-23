# Database design for a connected phase

The additive sourcing migration keeps geographic records, categories, canonical products, variants, businesses, offers and price tiers separate. An optional pilot-business link preserves existing Phase 2 IDs. Stock tables and permissions remain untouched. [Geographic model](GEOGRAPHIC-DATA-MODEL.md)

Phase 2 implements the stock pilot in `supabase/migrations/`. It adds pilot eligibility, participating shops, private staff membership, buyer requests, shop assignments and a recipient-scoped revision feed. The existing browser catalogue remains the source for display metadata. A future shared catalogue can migrate the textual catalogue IDs without changing request or assignment ownership. [Stock pilot data flow](NEARBY-STOCK-CONFIRMATION.md)

| Domain | Relationships and access |
|---|---|
| Identity | Auth users own profiles and addresses. Business members connect profiles to businesses with explicit roles. |
| Geography | Countries contain regions, regions contain cities, and cities contain markets. Published public geo fixtures are readable. |
| Catalogue | Categories classify products. Products own variants. Businesses publish supplier offers and manage inventory and wholesale tiers. Public reads include only published fields. |
| Requirements | A buyer owns each requirement and invites businesses to quote. Only the buyer, invited businesses and authorised moderators can access private details. Each supplier can update only its own quotations. |
| Messaging | Conversation participants can read and create messages within their conversation. Private attachment reads follow the same membership checks. |
| Retail | A profile owns its cart and orders. Order items snapshot price and variant. Sellers can access only relevant fulfilment records. |
| Groups | A group deal owns membership rows with unique buyer/deal pairs. A transaction enforces deadline and quantity rules. |
| Services | Businesses own service providers and services. Booking participants retain scoped reads. A server constraint prevents conflicting slots. |
| Reviews and activity | Reviews reference fulfilled orders or bookings. Notifications target a specific user. Moderation actions require a separate audit record. |

Enable row-level security on exposed tables and grant the minimum Data API privileges. For owned updates, test both visibility and ownership after mutation. Use private Storage buckets for buyer attachments. Evaluate Realtime access at conversation membership boundaries. Keep service-role keys on the server.

Index foreign keys used for joins and ownership checks. Start with membership by profile and business, supplier offers by product, quotations by requirement, orders by buyer, and bookings by provider and slot. Verify those indexes against query plans on representative data before promoting the schema.

[Supabase Auth](https://supabase.com/docs/guides/auth) · [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) · [Query optimization](https://supabase.com/docs/guides/database/query-optimization) · [Supabase changelog](https://supabase.com/changelog.md)
