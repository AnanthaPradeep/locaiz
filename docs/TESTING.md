# Testing

Use `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` and `npm run test:e2e`.

Playwright serves the build in `dist/`, so run the build before browser checks.

Vitest covers search filters, quantity limits, idempotent checkout and group/wholesale pricing. Playwright covers checkout, wishlist, theme, city selection, booking, quotations, seller listings, catalogue filters, product comparison and stock confirmation. Responsive cases check widths 360, 390, 768, 1024, 1440 and 1920 and save review screenshots at 390, 768 and 1440.

WCAG 2.2 AA is the design target. Screen-reader review and an independent accessibility audit remain pending.

The CI stock job starts disposable Supabase and runs the tagged Playwright tests with real Auth, PostgREST and Realtime. These tests check separate browser sessions, independent seller replies, offline reconciliation, refresh persistence, cross-account RLS, unauthenticated access, invalid input, cancellation, expiry and duplicate submissions. [Local stock test setup](NEARBY-STOCK-CONFIRMATION.md)
