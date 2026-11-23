# Demo security and privacy

Sourcing fixtures and browser-local drafts are demonstrative. The sourcing migration uses RLS for every exposed table. Businesses and offers are visible publicly after operator publication. Trusted private membership controls draft-offer writes and owner reads. Column grants prevent suppliers from publishing an offer or reassigning its business. Technical attachments and verification documents remain outside the demo form.

In connected stock mode, Supabase Auth supplies the user identity. Buyer and seller reads go through RLS. Seller membership is stored in a non-exposed schema. The three mutation RPCs have authenticated-only execution grants, fixed empty search paths, fully qualified relations and explicit identity checks. Clients cannot write directly to request, assignment or notification tables. Pages uses only publishable credentials.

Demo activity is persisted in browser storage. Use fictional details in profile, address and messaging forms. The demo collects no payment data or credentials. Optional geolocation is used on the device to select one of two fixture cities. Map views make requests to OpenStreetMap.

A connected phase requires server-side validation, row-level access controls, role checks, attachment isolation, rate limits and auditing. The business and admin views currently expose only the current browser's demo activity.
