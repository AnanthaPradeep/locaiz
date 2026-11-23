import type { Listing } from "./catalog";
import { offers, products, type Offer, type Product } from "./sourcing/catalog";

type VariantId = "standard" | "gift";
type VariantFixture = { stock: number; surcharge: number; photos?: string[] };
type RetailFixture = {
  subcategory: string;
  together?: { variantId: VariantId; listingId: string };
  variants: Record<VariantId, VariantFixture>;
};

const retail: Record<string, RetailFixture> = {
  "studio-headphones": { subcategory: "Headphones", variants: {
    standard: { stock: 16, surcharge: 0, photos: ["headphones", "hero"] },
    gift: { stock: 5, surcharge: 150, photos: ["hero", "headphones"] },
  } },
  "stoneware-cups": { subcategory: "Drinkware", together: { variantId: "standard", listingId: "cup-club" }, variants: {
    standard: { stock: 24, surcharge: 0 },
    gift: { stock: 8, surcharge: 150 },
  } },
  "globe-lamp": { subcategory: "Lighting", variants: {
    standard: { stock: 10, surcharge: 0 },
    gift: { stock: 0, surcharge: 150 },
  } },
  "everyday-tote": { subcategory: "Bags", together: { variantId: "standard", listingId: "tote-club" }, variants: {
    standard: { stock: 32, surcharge: 0 },
    gift: { stock: 12, surcharge: 150 },
  } },
};

const variantLabels = { standard: "Standard", gift: "Gift packaging" } as const;

export function retailSubcategory(productId: string) {
  return retail[productId]?.subcategory;
}

export function togetherListing(productId: string, variantId: VariantId) {
  const deal = retail[productId]?.together;
  return deal?.variantId === variantId ? deal.listingId : undefined;
}

export type ProductSourcing = { product: Product | undefined; offers: Offer[] };

export function productSourcing(productId: string, variantId: VariantId = "standard"): ProductSourcing {
  const product = products.find((entry) => entry.legacyId === productId);
  return {
    product,
    offers: product && variantId === "standard" ? offers.filter((offer) => offer.productId === product.id) : [],
  };
}

export type RetailVariant = {
  id: VariantId;
  label: (typeof variantLabels)[VariantId];
  sku: string;
  photos: string[];
  price: number;
  stock: number;
  cartKey: string;
};

export function availableCartUnits(variant: RetailVariant, cart: Record<string, number>) {
  return Math.max(0, variant.stock - (cart[variant.cartKey] ?? 0));
}

export function retailVariants(item: Listing): RetailVariant[] {
  const ids: VariantId[] = ["standard", "gift"];
  return ids.map((id) => {
    const variant = retail[item.id]?.variants[id];
    return {
      id,
      label: variantLabels[id],
      sku: `${item.id}-${id}`,
      photos: variant?.photos ?? (item.image ? [item.image] : []),
      price: (item.price ?? 0) + (variant?.surcharge ?? 0),
      stock: variant?.stock ?? 0,
      // Keep the original Standard key so persisted demo carts remain readable.
      cartKey: id === "standard" ? item.id : `${item.id}:${id}`,
    };
  });
}
