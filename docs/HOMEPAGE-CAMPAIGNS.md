# Homepage campaigns

The Featured collections section follows marketplace navigation and precedes Trending finds. It uses one split featured banner above two collection cards on larger screens. At 650px and below the cards stack, and the featured banner uses its separate portrait source through picture/source. HTML copy sits beside or below the artwork on a theme-aware surface.

Edit src/home-campaigns.ts to add or update a card. Supply a unique id, title, description, CTA, internal URL, image filename, layout, order and enabled flag. Optional mobileImage selects a mobile composition. Disabled entries are omitted. Set sponsored only for paid placements, and supply discountLabel only when it represents an actual configured offer. The defaults are LOCAIZ-curated.

| Campaign | Destination | Files in public/images/campaigns |
| --- | --- | --- |
| Crafted Close to Home | Shop, Handmade & Regional | crafted-close-home-desktop.webp, crafted-close-home-mobile.webp |
| Upgrade Your Everyday Tech | Shop, Electronics & Audio and Computer & Mobile Accessories | everyday-tech-card.webp |
| From Workshops to Factories | Global Atlas, Wholesale and industrial | workshops-factories-card.webp |

## ImageGen art direction

All four originals use built-in ImageGen. The desktop artisan still life has woven baskets, clay cups and brassware on warm stone and plaster, with the subjects on the right and negative space on the left. The separate portrait artisan still life groups the same subjects centrally in natural window light. The tech still life shows wireless headphones, a USB-C hub and a charger on a warm neutral desk. The sourcing image shows a machined metal shaft coupling on a clean work surface with a blurred CNC workshop. All prompts request no text, logos or labels. WebP exports are resized from those originals.

## Coverage

Unit tests cover order, disabled entries, optional labels, and responsive image markup. Playwright covers placement, the three filtered CTA routes, image loading, keyboard focus, dark theme, and layout at 360, 390, 768, 1024 and 1440 pixels.
