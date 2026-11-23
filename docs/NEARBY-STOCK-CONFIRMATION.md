# Nearby Stock Confirmation

The Nagercoil pilot covers Electronics & Accessories. It uses the existing LOCAIZ catalogue IDs and variant names. The pilot table controls geography, category and lifetime. A second pilot can be provisioned with its own eligible variants and participating businesses.

## Buyer and seller flow

1. A buyer opens **Check Nearby Stock** from Nearby or a product detail, signs in and selects up to three shops. Quantity defaults to one. The pickup date and message are optional.
2. The create RPC checks catalogue eligibility, shop participation, the authenticated buyer, and the five-per-hour limit. It inserts the request and its shop assignments in one transaction. A buyer-scoped submission ID makes retries idempotent.
3. Staff sign into **Business → Stock Requests**. Trusted membership data determines which assigned shops appear. An available reply carries an INR unit price and pickup time. An out-of-stock reply can include a restock estimate. The first valid reply is final.
4. Each write increments affected users' revision in `stock_feed`. Realtime subscribers receive their own revision and reload authorised rows. The browser also refetches on reconnect, on tab focus, and periodically. Stock updates appear under **Notifications → Stock notifications**.

The pilot gives stock information. Price and availability can change before pickup. There is no reservation operation.

## Access and expiry

The Data API allows authenticated reads under RLS. Buyers see their requests and all of their assigned shops. Seller staff see the requests assigned to their memberships and only the reply rows for their own shops. Authenticated clients have no table write grants. Three RPCs validate and perform creation, response and cancellation. Private membership lives outside the exposed schemas.

Request and per-shop expiry are derived from the persisted deadline. The database checks that deadline under a row lock before accepting a reply, even when clients are offline. The UI refreshes expiry labels on a short timer. Reply timestamps are stored as timestamptz and displayed in the browser's time zone. Prices are stored in `numeric(12,2)`. The pilot accepts INR.

## Local development

Use Node 22, Supabase CLI v3 and Docker. Run `supabase start` from the repository root. The CLI starts an unlinked local stack and applies the migration. Use `supabase status -o json` locally to obtain its API URL, publishable key and local admin key. Do not paste the admin key into a Vite env variable.

Set these environment variables in the terminal running the commands:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Local API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key or the local stack's legacy anon key |
| `VITE_STOCK_PILOT` | Optional pilot ID, defaults to `nagercoil` |
| `LOCAIZ_LOCAL_ADMIN_KEY` | Local admin or service-role key used by the seed script only |
| `LOCAIZ_PILOT_PASSWORD` | Developer-generated password of at least 12 characters |

```sh
npm ci
node scripts/seed-stock-pilot.mjs
npm run build
npx playwright install chromium
npm run test:e2e -- --grep @stock
```

The script is restricted to loopback URLs. It provisions buyer-a, buyer-b, seller-a, seller-b and seller-c at `stock.example.com`, with one staff member per labelled pilot test shop. Keep the admin key out of the shell that serves the frontend after seeding. Tests need a fresh local database or previous acceptance requests cleared on the disposable stack.

## Hosted onboarding

Use a dedicated LOCAIZ Supabase project. Review the migration and obtain approval before applying it to a hosted environment. Disable public signup for an invitation-only pilot. Provision and verify shops and their business accounts before setting `active` and clearing `is_demo`. Add staff memberships through an authorised database operator. The seed script is for local testing.

Set GitHub repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` only after the target environment has been approved, migrated and tested. Use a publishable key. The Pages build uses the same variables and continues serving Demo Mode when both are absent. Production migrations aren't part of CI or the Pages workflow.

[Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) · [Database functions](https://supabase.com/docs/guides/database/functions) · [CLI v3 migration](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3)
