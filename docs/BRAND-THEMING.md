# Brand theming

Header and footer use BrandHome and BrandLogo. BrandLogo renders the original SVG paths and view boxes from the public brand files. The light theme uses a Royal Black tile and wordmark with a cream inset mark. Dark mode reverses the tile and inset mark and uses a Creamy Milk White wordmark. The startup icon uses the same symbol path inserted at build time.

The HTML head applies the saved theme from the existing Zustand storage key before mounting React. Invalid or unavailable storage uses light. The store validates persisted theme values and updates the document root and browser theme colour immediately on toggle. The bundled install icons remain the static original artwork.
