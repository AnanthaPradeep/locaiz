# Phase 4 marketplace modules

## Running the modules

The public Pages build exposes local sourcing, Visual Search and language selection. The existing `VITE_MARKETPLACE_FOUNDATION=1` feature flag also requires the existing Supabase URL and publishable key. Enabling the connected build exposes Together, Care and Seller Insights. Apply the project's migrations in order to the connected database. Production credentials belong in the deployment environment.

## Behaviour and security

- The sourcing draft provider runs deterministic extraction locally. The buyer can edit the draft before handing it to the existing live requirement form. The assistant can look up verified published supplier offers when the buyer requests a search. It displays original currency, MOQ differences and declared shipping coverage. The live form retains explicit supplier selection and an explicit send action.
- Visual Search compares colour, layout and edges against sample Shop photos. The selected photo stays in memory and its preview URL is revoked on replacement, removal or navigation. The browser fetches catalogue photos only. Use technical specifications for compatibility.
- The language selector switches English, Tamil and Malayalam UI labels. Bundled dictionaries and local script fonts require no machine translation calls. Seller-authored content and quote specifications remain in their original language.
- Together serializes quantity updates on the group row, and each participant has one quantity per group. The supplier accepts the group separately from reaching the minimum. The group flow records no payment.
- Care requires an approved service business and provider-submitted availability. A provider-wide lock prevents overlapping availability, and appointment requests reserve one slot transactionally. Appointment messages are private to the buyer and provider. Completed appointments can receive one buyer rating.
- Seller Insights reads only managed business records. Signed-in views are deduplicated per product and hour. Response and rate statistics are suppressed for small samples. Signed-in search impressions are recorded from bounded catalogue result pages without the search term. Own-catalogue demand groups and stock-to-pickup rates require at least five distinct buyers. Event tables are private, and the UI shows aggregate counts.

External AI, connected visual matching, full translation coverage, analytics retention automation and market-wide demand reporting require additional implementation or production configuration.
