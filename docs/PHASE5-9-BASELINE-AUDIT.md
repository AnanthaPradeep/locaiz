# Phase 5–9 baseline audit

Reviewed main at `f82c3e175be636981d5a100457855c56e279563f`. [Baseline CI](https://github.com/AnanthaPradeep/locaiz/actions/runs/45688546202) and [Pages deployment](https://github.com/AnanthaPradeep/locaiz/actions/runs/45689040197) passed.

| Surface | Repository evidence | Operational status |
| --- | --- | --- |
| Home, PLP, PDP, cart, wishlist, campaigns and Atlas | `src/home.tsx`, catalogue, shared router and public Playwright suite | Public demo with illustrative data |
| Buyer identity, seller membership and verification | Foundation migrations, `src/market-foundation.ts`, foundation SQL tests | Connected via Supabase with application flags; disposable CI is the verified environment |
| Nearby stock, pickup, messaging and RFQ | Stock, journey and pickup migrations and SQL tests | Connected workflows exercise distinct test accounts in CI |
| Quotes, orders, booking and pooled requirements | Journey, Care and Together migration/test families | Workflow records and state transitions; commercial payment processing remains pending |
| Storefront, reviews and seller insights | Storefront, review and seller insights SQL tests | Connected support in repository; hosted operational evidence pending |
| Phase 4 intelligence | [Phase 4 inventory](PHASE4.md) | Review implementation and limits per capability before enabling integrations |

Supabase migrations are versioned and applied in the disposable CI stack. SQL suites exercise actor permissions and direct access boundaries. Hosted migration history, Auth delivery, business membership across independent real accounts, operator access, and Storage configuration need separate staging evidence. Baseline checks covered 46 unit tests, 73 public browser tests and 12 connected browser tests.

GitHub Pages is the public demo. Hosted staging and production project access, email configuration, provider credentials, backup and restore verification, monitoring and alert ownership remain open. [Security audit](SECURITY-AUDIT.md) and [Phase 5 readiness](PHASE5-PRODUCTION-READINESS.md) track the gates.
