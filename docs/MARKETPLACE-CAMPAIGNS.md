# Marketplace campaign configuration

The shared configuration lives in `src/marketplace-campaigns.ts`. Entries define page, placement, order, title, description, CTA, image paths, enabled state and optional connected destination. Hero and inline selection takes the first enabled campaign in order. Collection entries render in order.

Campaign cards use the existing homepage renderer. Main images switch composition at 650 pixels. Same-page actions focus the existing results or form to preserve filters and typed values. External-to-page Connect campaign links confirm before leaving dirty form state.

Global Atlas collections link to the Tamil Nadu and Kerala regional filters and the existing Wholesale and industrial category. Connect links to Small manufacturer sourcing and the regional directory. Business links use demo onboarding or connected Seller Studio. Care retains its separate live service link in connected mode.

The initial placements are LOCAIZ-curated. Sponsored comes from explicit sponsorship configuration. Any discount requires an active configured offer ID and label. Generated scenes carry Illustrative where a visitor could mistake them for a listed venue or provider.
