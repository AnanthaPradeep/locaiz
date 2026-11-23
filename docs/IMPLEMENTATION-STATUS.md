# Implementation status

The first PLP increment adds URL-backed price filtering, price sorting in both directions and grid/list views to Shop and universal search. It reuses the demo catalogue, product cards, wishlist and detail routes.

Village-to-Global extends the demo catalogue and existing entry points. Browser-local enquiries and storefront drafts use the existing store. The additive Supabase schema has no hosted connection. Authenticated Nearby Stock Confirmation continues to use its Phase 2 configuration.

The local code implements the initial browser demo across all seven marketplace destinations. See the [feature matrix](FEATURE-MATRIX.md) for gaps against the full brief. The frontend uses fixture prices, shops, stock, provider and supplier records; transactions stay in the browser.

Backend work is documented at the design level. Full marketplace data, production auth, sharing between participants, private attachments, seller verification, and real fulfilment remain pending. Public demo publication requires GitHub access and repository approval.

## Verified locally

- The locked dependency install completed.
- Lint, TypeScript checks, four Vitest tests and the Vite production build passed with Node 22.22.0.
- All eleven Playwright tests passed against the production bundle in Chrome, including the six requested viewport widths.
- The brand ZIP passed its integrity check. All three guideline pages were rendered and visually reviewed.
- The production build reports chunk-size warnings. MapLibre loads on demand.

GitHub Actions published the [public Pages demo](https://ananthapradeep.github.io/locaiz/). Its homepage, Shop route and Shop route refresh were verified after deployment.

The Phase 2 source includes an opt-in Supabase stock pilot. When the frontend has no Supabase configuration, the existing stock experience is labelled Demo Mode. A hosted LOCAIZ Supabase project and verified participating shops have yet to be configured. The connected test suite targets a disposable local Supabase stack.

## Verified locally

- The locked dependency install completed.
- Lint, TypeScript checks, four Vitest tests and the Vite production build passed with Node 22.22.0.
- All eleven Playwright tests passed against the production bundle in Chrome, including the six requested viewport widths.
- The brand ZIP passed its integrity check. All three guideline pages were rendered and visually reviewed.
- The production build reports chunk-size warnings. MapLibre loads on demand.

GitHub Actions and the public Pages URL remain unverified.
