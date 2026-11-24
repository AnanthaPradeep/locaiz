import { describe, expect, it } from "vitest";
import {
  compareMatches,
  evaluate,
  searchUrl,
  snapshot,
  type SavedSearch,
} from "./saved-search";

describe("saved search matching", () => {
  it("canonicalizes repeated Unicode criteria and excludes page", () => {
    const criteria = snapshot(
      "shop",
      new URLSearchParams(
        "category=B&view=list&category=A&category=B&page=4&q=சென்னை",
      ),
    );
    expect(new URLSearchParams(criteria.query).getAll("category")).toEqual([
      "A",
      "B",
    ]);
    expect(searchUrl(criteria)).toContain("view=list");
    expect(searchUrl(criteria)).not.toContain("page=");
    expect(new URLSearchParams(criteria.query).get("q")).toBe("சென்னை");
  });
  it.each(["", "maxPrice=-1", "minPrice=9&maxPrice=2", "maxMoq=2.5"])(
    "rejects invalid criteria %s",
    (query) => {
      expect(() => snapshot("shop", new URLSearchParams(query))).toThrow();
    },
  );
  it.each([
    ["shop", "Alabaster Match Demo Lamp", "/listing/shop/demo-match-alabaster-lamp"],
    ["sourcing", "Demo restock offer", "#demo-match-reed-mat-offer"],
  ] as const)(
    "alerts once for a newly published %s sample",
    (scope, q, target) => {
      const criteria = snapshot(scope, new URLSearchParams({ q }));
      const search: SavedSearch = {
        ...criteria,
        id: "search",
        name: q,
        seen: [],
        enabled: true,
        revision: 1,
        checked: "",
      };
      expect(evaluate(criteria, false)).toEqual([]);
      const matches = evaluate(criteria, false, true);
      const first = compareMatches(search, matches, "2026-01-01");
      expect(first.alerts).toHaveLength(1);
      expect(first.alerts[0].href).toContain(target);
      expect(
        compareMatches(first.search, matches, "2026-01-02").alerts,
      ).toEqual([]);
    },
  );
});

it("keeps place, supplier role, MOQ, pickup and destination on the same offer", () => {
  const params = new URLSearchParams(
    "q=handwoven&place=surat&role=Wholesaler&pickup=1&destination=IN&maxMoq=20",
  );
  expect(evaluate(snapshot("sourcing", params), false)).toHaveLength(1);
  params.set("maxMoq", "1");
  expect(evaluate(snapshot("sourcing", params), false)).toEqual([]);
});

it("matches the same canonical criteria regardless of facet order", () => {
  expect(
    snapshot("shop", new URLSearchParams("category=A&category=B&view=list"))
      .query,
  ).toBe(
    snapshot("shop", new URLSearchParams("category=B&category=A&category=A"))
      .query,
  );
});
