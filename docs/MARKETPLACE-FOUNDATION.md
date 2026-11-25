# Marketplace Foundation Phase 1

The public GitHub Pages build runs with Demo Mode. Connected Marketplace is enabled only when a build has VITE_MARKETPLACE_FOUNDATION=1 and the existing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. The feature shares the stock pilot Supabase client and session. No service key is included in the browser.

## Run a disposable environment

1. Install Supabase CLI v3 and Docker. At the repository root run supabase start. The local config enables email verification. Mailpit captures signup and recovery email locally.
2. Run supabase status to obtain the local URL and publishable key. Set the three browser variables above for npm run dev or for a production preview build. Use the same origin for the email callback, app and PKCE session. The repository test configuration uses http://127.0.0.1:4173.
3. Use Sign In or visit /#/account/sign-in. Verify the disposable email before signing in. Use /#/business/studio for businesses and catalogue. Invitations are privately shared links bound to a verified recipient email. A business owner invites managers and catalogue editors.
4. Trust operators require an authorised out-of-band insert into sourcing_private.operators. The CI workflow adds its own disposable operator. Never grant browser clients insert privileges on that table.
5. Before enabling a hosted deployment, grant the operator role through a reviewed process, configure permitted confirmation and recovery URLs, production email delivery, upload handling and abuse controls, and verify policies against disposable accounts. Never configure the demo GitHub Pages workflow with these credentials.

## Publication and moderation

Create a business and submit verification. A trust operator reviews private evidence and can approve, reject or restrict it. Create product drafts with variants, supplier offers, price tiers and inventory. Submit a draft, record moderation, and approve publication after the business passes review. Approved offers appear in connected Shop, Search and Published Supplier Offers. The existing Shop PDP route opens the approved product and the Supplier Trust Passport. Sellers can archive a listing and remove its public offers.

Only defined database membership roles can act on a business. Sensitive evidence is in a private bucket. Images allow PNG, JPEG and WebP up to 5 MB. Evidence additionally allows PDF. Private evidence URLs last one minute. The public gallery can sign only attached approved product media. A storage upload and its metadata attachment are separate; a failed attachment can leave a private orphan for operator cleanup. Browser MIME validation and bucket limits are in place. Content scanning and hosted email delivery are operational follow-up work.

## Verification

The migration and tenant-isolation SQL run with the existing disposable stock workflow. Connected browser tests use controlled accounts for registration, email verification, password recovery, seller product creation, image validation and approval. Standard browser tests check public Demo Mode. Cart, buyer enquiries, payment and live fulfilment continue on their existing flows.

See [Supabase local Auth testing](https://supabase.com/docs/guides/auth/testing-auth-flows) and [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
