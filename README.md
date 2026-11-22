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
