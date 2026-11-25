import { expect, test } from "vitest";
import { findListings } from "./catalog";
const search = (query: string, category?: string) =>
  findListings(query, "shop", category, undefined, false, true);

test("ranked catalogue search prioritizes exact names and tolerates a transposition", () => {
  expect(search("Studio Wireless Headphones")[0]?.id).toBe("studio-headphones");
  expect(search("wireles headphones")[0]?.id).toBe("studio-headphones");
});

test("uses consumer synonyms within the selected department", () => {
  expect(
    search("headset", "Electronics & Audio").map((item) => item.id),
  ).toContain("studio-headphones");
  expect(search("headset", "Fashion & Apparel")).toEqual([]);
});

test("does not correct numeric identifiers to another specification", () => {
  expect(search("charger 66W")).toEqual([]);
});
