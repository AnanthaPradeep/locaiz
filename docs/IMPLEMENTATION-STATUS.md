# Implementation status

## Phase 4 release

The public Pages build includes an editable sourcing draft, browser-based visual matching against sample Shop images, and English, Tamil and Malayalam selection for core interface labels.

The connected build includes verified supplier lookup, authenticated Together pledges with separate supplier acceptance, provider-managed Care appointments and private booking messages, and permission-scoped seller activity and demand aggregates. CI tests these workflows against disposable Supabase. Production activation requires a hosted LOCAIZ backend and applied migrations.

External model integration, connected visual matching, and full translation coverage remain open. See [Phase 4 setup and safeguards](PHASE4.md).

## Earlier implementation notes

Cart, checkout and Quick View show the selected variant photo and product details. Product details use a 4px text gap and wrap on narrow screens.

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

About and Contact have public hash routes. Contact offers category routing and a validation-only demo preview. Live support submission and verified organisation details are pending.

The shared footer includes marketplace, account, support and company navigation with a dynamic copyright year. Social icons are visible as standalone marks. Links activate only for enabled, validated official profiles. Unit tests exercise social markup and Playwright covers routes and responsive layout.

Shop includes 50 illustrative products across ten departments with 12 items per page, URL-backed filters, product-specific details and 50 local primary images. Run node scripts/audit-catalogue.mjs with Node 22 to verify the seed and image inventory. See PRODUCT-IMAGE-SOURCES.md and the catalogue contact sheet for image provenance and mappings.

Saved Searches and Match Alerts support Shop, Universal Search and Global Atlas in browser-local Demo Mode. See [Saved Searches](SAVED-SEARCHES.md) for the simulator and [Matching Engine](MATCHING-ENGINE.md) for the future authenticated design.
The desktop Shop filter panel stays in view while scrolling results, with a fixed heading and a separate scroll area for filter options. The mobile Filters dialog remains available.

Supplier Quote Comparison supports same-requirement comparisons, explicit cost completeness and delivery warnings, and local buyer decisions. See [Supplier Quote Comparison](SUPPLIER-QUOTE-COMPARISON.md).

Find It Your Way connects Home, guided Search, PDP buying options, the existing stock pilot and a reviewed Connect handoff. See [Find It Your Way](FIND-IT-YOUR-WAY.md).
Search fields in the header, Shop and guided discovery use an inverse surface with theme-aware text, placeholder and focus contrast.

Home includes three curated campaigns with responsive ImageGen artwork, theme-aware HTML copy and filtered Shop or Global Atlas destinations. See [Homepage campaigns](HOMEPAGE-CAMPAIGNS.md).

Header and Footer share theme-aware original SVG branding. First load uses a branded overlay with saved-theme bootstrap and recovery states. See [App loading screen](APP-LOADING-SCREEN.md).

The repository includes an optional connected Marketplace Foundation build. Public GitHub Pages remains Demo Mode. See [setup and verification](MARKETPLACE-FOUNDATION.md).

## Phase 5 production readiness

See [Phase 5 readiness](PHASE5-PRODUCTION-READINESS.md) and the [baseline audit](PHASE5-9-BASELINE-AUDIT.md). Hosted verification and pilot activation are pending.

## RFQ drafts and regional crafts

The signed-in Buyer workspace can save an unfinished RFQ to this browser. My Buying Journey lists drafts for the current account, including the last edit time and Resume and Delete actions. Drafts contain form text and supplier IDs. Attachment files stay out of browser storage and must be selected again. Successful submission removes the draft. Drafts are browser-local and the browser profile owner can access its stored data.

Home includes curated Tamil Nadu and Kerala craft examples with ImageGen collection and craft illustrations. A craft opens a prefilled requirement in the public demo or an RFQ in a connected build. These examples are sourcing prompts with illustrative images. Seller availability and provenance depend on the actual supplier offer.

Craft references: [Tamil Nadu Handicrafts Development Corporation](https://tnhdc.poompuhar.com/welcome/handicraftmap) and [Kerala Tourism](https://www.keralatourism.org/souvenirs).

## Regional Maker Discovery

Home craft cards and Global Atlas open the regional maker directory. State, craft and locality filters use shareable hash routes. Demo mode provides labelled sample makers and local sourcing requests. Connected results use published, current offers from verified maker businesses based in the selected region. Maker profiles carry the craft and preferred supplier into the signed-in RFQ. A general sourcing request is available when a craft has no maker match.

## Custom craft briefs and sample quotes

Regional basket, painting and textile sourcing forms offer craft-specific fields and an optional sample quantity alongside the planned bulk quantity. Connected buyers can review the selected makers and delivery details, save a draft, or send the RFQ. Sellers see the readable brief in the conversation and may provide sample cost, lead time, and a delivery option in their quote. Sample terms are informational and excluded from bulk order totals. The public demo reviews and saves a local requirement. The signed-in workflow runs in the disposable CI backend.

## Sample approval and bulk order handoff

Connected RFQ conversations can confirm and track quoted samples separately from bulk orders. The buyer chooses an offered delivery method, confirms receipt and approves or requests changes with feedback. The maker marks preparation and shipment or pickup readiness. A changes request requires a newer sample quote for the next round. Earlier rounds and feedback remain visible in the conversation. My Buying Journey includes a Samples activity filter.

A sample request is optional until accepted by the buyer. Once requested, the latest round must be approved before a bulk order can be created for that conversation. The approved sample is snapshotted alongside the bulk quote on explicit order confirmation. Sample charges do not enter bulk totals. Public Demo Mode continues to show sample terms and draft requirements. Connected lifecycle verification uses disposable Supabase only.
