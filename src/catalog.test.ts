import { describe, expect, it } from "vitest";
import {
  demoCatalog,
  findListings,
  groupPrice,
  wholesalePrice,
} from "./catalog";
import { useDemo } from "./store";

describe("marketplace catalog", () => {
  it("searches across listings and applies city and category filters", async () => {
    expect(
      (await demoCatalog.search("headphone")).map((item) => item.section),
    ).toEqual(expect.arrayContaining(["shop", "care"]));
    expect(
      findListings("", "nearby", "Fashion", "Coimbatore").map(
        (item) => item.id,
      ),
    ).toEqual(["loom"]);
    expect(findListings("nonexistent listing")).toEqual([]);
  });
  it("unlocks discounts at the group or wholesale threshold", () => {
    expect(groupPrice(1299, 19)).toBe(1299);
    expect(groupPrice(1299, 20)).toBe(1039);
    expect([25, 99, 100, 249, 250].map(wholesalePrice)).toEqual([
      420, 420, 350, 350, 310,
    ]);
  });
  it("caps cart quantities and supports removal", () => {
    useDemo.getState().setCart("stoneware-cups", 123);
    expect(useDemo.getState().cart["stoneware-cups"]).toBe(99);
    useDemo.getState().clearCart();
    expect(useDemo.getState().cart).toEqual({});
  });
  it("records exactly one order when checkout is retried with an empty cart", () => {
    useDemo.getState().setCart("stoneware-cups", 1);
    const previous = useDemo.getState().orders.length;
    useDemo.getState().checkout("One stoneware cup");
    useDemo.getState().checkout("One stoneware cup");
    expect(useDemo.getState().orders).toHaveLength(previous + 1);
    expect(useDemo.getState().cart).toEqual({});
  });
});
