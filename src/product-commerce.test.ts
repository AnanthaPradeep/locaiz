import { expect, it } from "vitest";
import { products } from "./catalog";
import { availableCartUnits, productSourcing, retailVariants, togetherListing } from "./product-commerce";

it("keeps gift inventory, pricing, and cart identity independent", () => {
  const item = products.find((entry) => entry.id === "studio-headphones")!;
  const [standard, gift] = retailVariants(item);
  expect([standard.stock, gift.stock]).toEqual([16, 5]);
  expect(gift.price - standard.price).toBe(150);
  expect([standard.cartKey, gift.cartKey]).toEqual([item.id, item.id + ":gift"]);
  expect(productSourcing(item.id, standard.id).offers).toHaveLength(2);
  expect(productSourcing(item.id, gift.id).offers).toHaveLength(0);
  expect(togetherListing("stoneware-cups", standard.id)).toBe("cup-club");
  expect(togetherListing("stoneware-cups", gift.id)).toBeUndefined();
});

it("caps each variant independently and rejects missing demo stock", () => {
  const item = products.find((entry) => entry.id === "globe-lamp")!;
  const [standard, gift] = retailVariants(item);
  expect(availableCartUnits(standard, { [standard.cartKey]: 9 })).toBe(1);
  expect(availableCartUnits(standard, { [standard.cartKey]: 11 })).toBe(0);
  expect(availableCartUnits(gift, {})).toBe(0);
  expect(availableCartUnits(standard, { [gift.cartKey]: 3 })).toBe(10);
});
