import type { Listing } from "./catalog";

const details: Record<string, { stock: number; giftStock: number; photos?: string[] }> = {
  "studio-headphones": { stock: 16, giftStock: 5, photos: ["headphones", "hero"] },
  "stoneware-cups": { stock: 24, giftStock: 8 },
  "globe-lamp": { stock: 10, giftStock: 0 },
  "everyday-tote": { stock: 32, giftStock: 12 },
};

export const retailSubcategory: Record<string, string> = {
  "studio-headphones": "Headphones",
  "stoneware-cups": "Drinkware",
  "globe-lamp": "Lighting",
  "everyday-tote": "Bags",
};

export const togetherProduct: Record<string, string> = {
  "stoneware-cups": "cup-club",
  "everyday-tote": "tote-club",
};

export function retailVariants(item: Listing) {
  const fixture = details[item.id];
  const photos = fixture?.photos ?? (item.image ? [item.image] : []);
  return [
    { id: "standard", label: "Standard", stock: fixture?.stock ?? 0, extra: 0, photos },
    { id: "gift", label: "Gift packaging", stock: fixture?.giftStock ?? 0, extra: 150, photos: [...photos].reverse() },
  ].map(({ extra, ...variant }) => ({
    ...variant,
    sku: `${item.id}-${variant.id}`,
    price: (item.price ?? 0) + extra,
    // Keep the original Standard key so existing demo carts remain readable.
    cartKey: variant.id === "standard" ? item.id : `${item.id}:${variant.id}`,
  }));
}
