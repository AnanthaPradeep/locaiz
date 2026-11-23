# Implementation status

Shared product cards use a native PDP link over the full card surface. Retail cart and wishlist controls work independently, with variant selection and demo stock limits. Playwright saves responsive screenshots in test output instead of replacing the tracked documentation images.

Retail checkout remains a demo. The retail model links variants to cart keys, stock request names, sourcing product offers and Together listing IDs. Configured environments can browse published offers separately at `/sourcing/published`. That repository applies category, supplier review, offer filtering, ordering and pagination on the server. It reads the existing restricted supplier review status and never grants buyer or seller write access to that field. The Pages build remains in Demo Mode.

The PLP/PDP draft adds combinable product facets, a keyboard-accessible quick-view dialog, variant-specific demo retail pricing and stock limits, gallery thumbnails and navigation, and a Together link for eligible standard variants. Sourcing offers keep original currencies and link to the existing quote form. Supplier verification and other live catalogue attributes require published records.

The authenticated stock Playwright cases skip in the ordinary demo suite because they require a seeded loopback Supabase instance and pilot credentials. The GitHub Actions stock-pilot job provisions and seeds that instance, runs sourcing RLS checks, and runs both authenticated browser cases.

Shop and universal search support URL-backed price filtering, price sorting in both directions, pagination and grid/list views. The product detail page supports keyboard-accessible image enlargement and retail quantity validation with a subtotal. Products with an explicit sourcing catalogue link display sample supplier offers and tier prices and link to the existing Product Passport for enquiries.

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
