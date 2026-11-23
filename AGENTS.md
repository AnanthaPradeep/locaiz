# LOCAIZ development

Use Node 22 and the npm lockfile. Run lint, typecheck, unit tests and a production build after application changes. Run Playwright when changing routes, shared layout or marketplace flows.

Preserve hash routing and base-relative public asset paths. Keep fixtures clearly labelled and place catalogue logic outside React components. Route local demo changes through the Zustand store. Keep privileged credentials, payment data and sensitive documents out of browser code and persistence.

Use the semantic theme tokens in src/styles.css and the existing brand paths in public/brand. Update the implementation status when a feature changes.

For completed features, run local verification, push the feature branch, update the pull request, and wait for GitHub checks and required approvals. Merge through the repository's configured strategy, monitor the automatic GitHub Pages deployment, and verify the relevant live routes. Keep incomplete features in review or behind a feature flag.
