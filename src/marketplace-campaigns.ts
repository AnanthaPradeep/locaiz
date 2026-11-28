import type { HomeCampaign } from "./home-campaigns";

export type CampaignPage = "nearby" | "global-atlas" | "care" | "connect" | "business";
type Placement = "hero" | "collection" | "inline";
export type MarketplaceCampaign = Omit<HomeCampaign, "layout" | "discountLabel"> & {
  page: CampaignPage;
  placement: Placement;
  connectedHref?: string;
  illustrative?: boolean;
  verifiedOffer?: { id: string; discountLabel: string; active: boolean };
};

const source = (key: string, value: string) => "/sourcing?" + new URLSearchParams({ [key]: value });
export const campaignMediaRoot = "images/marketplace-campaigns/";
function hero(page: CampaignPage, image: string, title: string, description: string, ctaLabel: string, href: string, connectedHref?: string): MarketplaceCampaign {
  return { id: page + "-hero", page, placement: "hero", title, description, ctaLabel, href, connectedHref,
    image: image + "-hero-desktop.webp", mobileImage: image + "-hero-mobile.webp", enabled: true, order: 0, illustrative: true };
}

function collection(page: CampaignPage, id: string, title: string, description: string, ctaLabel: string, href: string, order: number, connectedHref?: string): MarketplaceCampaign {
  return { id, page, placement: "collection", title, description, ctaLabel, href, connectedHref, image: id + ".webp", enabled: true, order, illustrative: true };
}

export const marketplaceCampaigns: readonly MarketplaceCampaign[] = [
  hero("nearby", "nearby", "Discover Shops Near You", "Explore local stores, independent makers and pickup options around your chosen area.", "Explore Nearby Shops", "#nearby-discovery-results"),
  hero("global-atlas", "atlas", "Explore Regional Makers", "Discover traditional crafts, skilled workshops and manufacturing capabilities from local communities to global markets.", "Discover Regional Crafts", "/sourcing/regional"),
  hero("care", "care", "Repairs Made Easier", "Explore repair, maintenance and technical service options for the products you use every day.", "Explore Repair Services", "#care-discovery-results"),
  hero("connect", "connect", "Need Something Made to Order?", "Share your product requirements and discover artisans, workshops and manufacturers who may be able to help.", "Start a Sourcing Request", "#connect-requirement", "/account/journey?new=1"),
  hero("business", "business", "Start Selling on LOCAIZ", "Bring your shop, craft studio or manufacturing business online and connect with buyers looking for what you make.", "Become a Seller", "/sourcing/onboarding", "/business/studio"),
  collection("global-atlas", "atlas-tamil-nadu", "Tamil Nadu Craft Heritage", "Discover handloom, reed weaving and metalwork traditions.", "Explore Tamil Nadu Crafts", "/sourcing/regional?region=tamil-nadu", 10),
  collection("global-atlas", "atlas-kerala", "Kerala Makers & Crafts", "Explore coir, mural art and textile traditions.", "Explore Kerala Crafts", "/sourcing/regional?region=kerala", 20),
  collection("global-atlas", "atlas-industrial", "Industrial & Workshop Sourcing", "Browse industrial products and workshops in Global Atlas.", "Explore Industrial Suppliers", source("category", "Wholesale and industrial"), 30),
  { ...collection("global-atlas", "atlas-rfq-inline", "Request a Supplier Quote", "Share your quantities and specifications with a sourcing request.", "Open Connect", "/connect", 40), placement: "inline" },
  collection("connect", "connect-manufacturing", "Custom Manufacturing", "Find a workshop for parts, prototypes or short production runs.", "Find Manufacturers", source("role", "Small manufacturer"), 10),
  collection("connect", "connect-artisan", "Artisan & Handmade Orders", "Explore regional crafts before writing a made-to-order brief.", "Find Artisan Makers", "/sourcing/regional", 20),
  collection("business", "business-retail", "Local Retailers", "Set up a profile for your independent shop.", "Explore Retail Selling", "/business/onboarding", 10, "/business/studio"),
  collection("business", "business-maker", "Artisans & Makers", "Introduce your craft and share what you can make.", "Explore Maker Onboarding", "/sourcing/onboarding", 20, "/business/studio"),
  collection("business", "business-wholesale", "Wholesale & Manufacturers", "Publish products and manage supplier enquiries.", "Explore Supplier Tools", "/business/inventory", 30, "/business/studio"),
];

export function selectCampaigns(page: CampaignPage, placement: Placement, campaigns = marketplaceCampaigns) {
  const matching = campaigns.filter((campaign) => campaign.enabled && campaign.page === page && campaign.placement === placement)
    .sort((a, b) => a.order - b.order);
  return placement === "collection" ? matching : matching.slice(0, 1);
}

export function campaignDiscount(offer?: MarketplaceCampaign["verifiedOffer"]) {
  return offer?.active && offer.id.trim() && offer.discountLabel.trim() ? offer.discountLabel : undefined;
}
