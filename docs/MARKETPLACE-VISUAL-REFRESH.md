# Marketplace visual refresh

| Page | Placement | Primary CTA |
| --- | --- | --- |
| Nearby | After filters and before map and shopping results | Focuses the active Nearby results without changing URL state |
| Global Atlas | After sourcing filters and locality navigation | Opens Regional Maker Discovery |
| Care | After filters and before the service list | Focuses current Care results |
| Connect | Outside and above the RFQ editor | Focuses the demo form or opens the connected buyer workspace |
| Business | Public Business landing entry | Opens demo supplier onboarding or the connected Seller Studio |

Atlas has Tamil Nadu, Kerala and industrial cards and one inline Connect promotion after the fourth offer when more offers follow on page one. Inline promotions stay outside offer counts and the map view. Connect warns before a campaign link navigates away with unsaved form edits. Business subpages and Seller Studio do not render campaigns.

The shared marketplace renderer reuses the homepage campaign card and retains the existing Shop image paths, actions and navigation. Discovery illustrations are assigned by known sample listing ID. Listings without a suitable image continue to use the icon fallback. See [campaign configuration](MARKETPLACE-CAMPAIGNS.md) and [image assets](MARKETPLACE-IMAGE-ASSETS.md).

Tests cover six viewport widths, responsive image source selection, keyboard entry to results, campaign links, unsaved form handling and the existing public and disposable connected flows. Theme tokens and reduced-motion styles apply to the new section.
