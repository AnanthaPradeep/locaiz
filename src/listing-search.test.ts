import { expect, test } from "vitest";
import { findListings } from "./catalog";

test("ranked catalogue search prioritizes exact names and tolerates a transposition", () => {
  expect(findListings("Studio Wireless Headphones")[0]?.id).toBe(
    "studio-headphones",
  );
  expect(findListings("wireles headphones", "shop")[0]?.id).toBe(
    "studio-headphones",
  );
});

test("uses consumer synonyms within the selected department", () => {
  expect(
    findListings("headset", "shop", "Electronics & Audio").map(
      (item) => item.id,
    ),
  ).toContain("studio-headphones");
  expect(findListings("headset", "shop", "Fashion & Apparel")).toEqual([]);
});

test("does not correct numeric identifiers to another specification", () => {
  expect(findListings("charger 66W", "shop")).toEqual([]);
});
