import { asset, type Listing } from "./catalog";
import { campaignMediaRoot } from "./marketplace-campaigns";

const illustrations: Partial<Record<Listing["section"], Record<string, string>>> = {
  nearby: {
    "form-frequency": "nearby-local-store",
    "clay-kiln": "nearby-artisan-counter",
    loom: "nearby-pickup",
  },
  care: {
    appliance: "care-appliance",
    audio: "care-electronics",
    mobile: "care-mobile-computer",
    electrical: "care-electrical",
    plumbing: "care-plumbing",
    vehicle: "care-vehicle",
  },
  global: {
    "weft-works": "atlas-hero-desktop",
    "form-assembly": "atlas-form-assembly",
    "tiruppur": "atlas-tiruppur",
    "surat": "atlas-surat",
    "sivakasi": "atlas-sivakasi",
    "moradabad": "atlas-moradabad",
    "yiwu": "atlas-yiwu",
    "shenzhen": "atlas-shenzhen",
    "guangzhou": "atlas-guangzhou",
    "bangkok": "atlas-bangkok",
    "dubai": "atlas-dubai",
    "istanbul": "atlas-istanbul",
    "ho-chi-minh": "atlas-ho-chi-minh",
  },
};

export function resolveMarketplaceImage(listing: Pick<Listing, "id" | "name" | "section" | "image">) {
  if (listing.image) return { src: asset("images/" + listing.image + ".webp"), alt: listing.name, illustrative: false };
  const illustration = illustrations[listing.section]?.[listing.id];
  if (illustration) return { src: asset(campaignMediaRoot + illustration + ".webp"), alt: "", illustrative: true };
  return undefined;
}
