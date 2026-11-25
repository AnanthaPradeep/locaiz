# Architecture

- `src/main.tsx` starts the query provider and hash router. Marketplace and account route modules load on demand.
- `src/shell.tsx` provides universal search, city and theme controls, and navigation.
- `src/catalog.ts` contains typed fixtures, pure search and pricing functions, and the asynchronous catalogue repository interface.
- `src/store.ts` persists demo cart, activity, profiles and preferences with Zustand.
- `src/home.tsx`, `src/marketplace.tsx` and `src/workspace.tsx` cover discovery, details and account or business actions. MapLibre loads on demand.

A connected deployment can implement the catalogue repository with Supabase queries. Move writable actions behind typed repositories and transactional server operations before sharing state across customers and businesses.

Marketplace Foundation reuses the stock Supabase session and sourcing database. The connected route modules are behind an explicit build flag. See [Marketplace Foundation](MARKETPLACE-FOUNDATION.md).
