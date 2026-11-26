# Staging setup

1. Select the approved staging hosting account and a dedicated Supabase project. Record each project reference and frontend origin in the deployment inventory.
2. Preview the pending repository migrations against the selected staging project with `supabase db push --dry-run` from a CLI checkout linked to staging. Review, apply and record migration versions and run SQL checks against controlled test fixtures.
3. Configure staging Auth Site URL, exact redirect origins, SMTP and email templates. In the staging build set `VITE_SUPABASE_URL` to the project HTTPS origin, `VITE_SUPABASE_PUBLISHABLE_KEY` to its publishable key and `VITE_MARKETPLACE_FOUNDATION=1`. Keep any CLI credentials in restricted operator configuration.
4. Use separate buyer, seller owner, seller manager, unrelated seller and operator test identities. Capture sign-up, email confirmation, reset and sign-out evidence. Exercise onboarding, stock confirmation, pickup, RFQ, attachment, quote revision, acceptance and fulfilment. Verify isolation and retry behavior.
5. Record browser logs, workflow evidence and outstanding failures with private payloads redacted. Run the recovery drill before approval.
