import { shopCategories } from "./demo-retail";

export type HomeCampaign = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  image: string;
  mobileImage?: string;
  layout: "featured" | "collection";
  enabled: boolean;
  order: number;
  sponsored?: boolean;
  discountLabel?: string;
};

function shopLink(...categories: (typeof shopCategories)[number][]) {
  return (
    "/shop?" +
    new URLSearchParams(categories.map((category) => ["category", category]))
  );
}

export const homeCampaigns: readonly HomeCampaign[] = [
  {
    id: "handmade",
    title: "Crafted Close to Home",
    description:
      "Discover handmade pieces, artisan favourites and region-inspired goods from independent makers.",
    ctaLabel: "Explore handmade",
    href: shopLink("Handmade & Regional"),
    image: "crafted-close-home-desktop.webp",
    mobileImage: "crafted-close-home-mobile.webp",
    layout: "featured",
    enabled: true,
    order: 10,
  },
  {
    id: "tech",
    title: "Upgrade Your Everyday Tech",
    description: "Shop essential audio and workspace tech for everyday use.",
    ctaLabel: "Shop tech",
    href: shopLink("Electronics & Audio", "Computer & Mobile Accessories"),
    image: "everyday-tech-card.webp",
    layout: "collection",
    enabled: true,
    order: 20,
  },
  {
    id: "workshops",
    title: "From Workshops to Factories",
    description:
      "Explore suppliers, tools and production-ready sourcing options from workshops and manufacturers.",
    ctaLabel: "Explore suppliers",
    href:
      "/sourcing?" +
      new URLSearchParams({ category: "Wholesale and industrial" }),
    image: "workshops-factories-card.webp",
    layout: "collection",
    enabled: true,
    order: 30,
  },
];
