![LOCAIZ](public/brand/wordmark.svg)

# LOCAIZ

**Local Roots. Global Reach.**

LOCAIZ is a browser-based marketplace demo for local discovery, retail shopping, wholesale sourcing, group buying and repair services. Sample transactions and preferences stay on the current device.

## Run locally

Use Node 22 and npm. Demo mode requires no environment variables or accounts.

```sh
npm ci
npm run dev
```

React and TypeScript power the frontend. Vite builds the static application. React Router uses hash routes for subpath hosting. Zustand stores local activity. TanStack Query reads the catalogue adapter. Radix, Lucide, Tailwind and CSS tokens support the UI. MapLibre uses OpenStreetMap imagery where available.

## Review the demo

- [Village-to-Global Marketplace](docs/VILLAGE-TO-GLOBAL.md)

- [Live GitHub Pages demo](https://ananthapradeep.github.io/locaiz/)
- [Nearby Stock Confirmation pilot setup](docs/NEARBY-STOCK-CONFIRMATION.md)

- Screenshots at [1440px](docs/screenshots/desktop.png), [768px](docs/screenshots/tablet.png) and [390px](docs/screenshots/mobile.png)
- [Feature matrix](docs/FEATURE-MATRIX.md) and [implementation status](docs/IMPLEMENTATION-STATUS.md)
- [Architecture](docs/ARCHITECTURE.md), [database design](docs/DATABASE-DESIGN.md) and [security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md) and [testing](docs/TESTING.md)
- [Brand kit ZIP](LOCAIZ-Brand-Kit.zip) and [brand guidelines](brand-kit/guidelines/LOCAIZ-Brand-Guidelines.pdf)
- [Photography and generation prompts](docs/IMAGE-ASSETS.md)

The demo uses fictional sellers, sample prices and simulated fulfilment. Map imagery is the only external runtime service. Live payments, real authentication and multi-user workflows require a backend.

## Quality checks

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

Public information routes are /#/about and /#/contact. See [About](docs/ABOUT-PAGE.md) and [Contact support](docs/CONTACT-SUPPORT.md).

### Footer social profiles

Set up the Follow LOCAIZ section in src/organisation.ts under organisation.socialProfiles. Add one enabled entry per confirmed official account. Choose the platform identifier and paste its HTTPS profile URL. Instagram and Facebook expect an account or page path, LinkedIn a company or showcase page, and YouTube a channel URL or handle. The four icons are visible by default. Each icon is non-interactive until its enabled URL passes validation. The four embedded brand marks come from Bootstrap Icons v1.13.1. See public/licenses/bootstrap-icons.txt.

The [Shop catalogue](docs/PLP-FEATURES.md) has fifty demo products and local images. See the [data model](docs/CATALOG-DATA-MODEL.md), [image provenance](docs/PRODUCT-IMAGE-SOURCES.md) and [validation commands](docs/PLP-TESTING.md).

Saved Searches and Match Alerts are available in browser-local Demo Mode. See [Saved Searches](docs/SAVED-SEARCHES.md) for usage and simulation.

See [Supplier Quote Comparison](docs/SUPPLIER-QUOTE-COMPARISON.md) to try the browser-local buyer decision workspace.

See [Find It Your Way](docs/FIND-IT-YOUR-WAY.md) for guided product and supplier discovery.

[Homepage campaigns](docs/HOMEPAGE-CAMPAIGNS.md) describes the curated collections, artwork and configuration.

See [Brand theming](docs/BRAND-THEMING.md) and [App loading screen](docs/APP-LOADING-SCREEN.md) for startup behaviour.

[Marketplace Foundation setup](docs/MARKETPLACE-FOUNDATION.md) covers the optional connected account, Seller Studio and moderation build.

[Buyer-to-seller journey and connected test setup](docs/BUYER-SELLER-JOURNEY.md)

### Marketplace discovery imagery

See the [marketplace visual refresh](docs/MARKETPLACE-VISUAL-REFRESH.md) for campaign placements, CTA routes and the ImageGen asset inventory.
