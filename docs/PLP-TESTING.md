# PLP testing

Run node scripts/audit-catalogue.mjs with Node 22 to validate product counts, identifiers, category counts, WebP headers, file size and SHA-256 uniqueness. Review the image contact sheet and sources in PRODUCT-IMAGE-SOURCES.md.

Run npm scripts for lint, typecheck, unit tests, production build and Playwright. The catalogue suite checks the five-page sequence, all fifty asset responses, quote-only PDP, multi-category filtering and URL persistence. Existing suites cover responsive layouts, cart, wishlist and authenticated stock isolation in CI.
