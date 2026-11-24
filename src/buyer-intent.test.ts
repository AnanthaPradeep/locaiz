import { expect, it } from "vitest";
import {
  connectIntent,
  parseIntent,
  retailOptions,
  sourcingOptions,
} from "./buyer-intent";
import { snapshot, searchUrl } from "./saved-search";

it("rejects invalid dates, quantities, countries and variants", () => {
  expect(
    parseIntent(
      new URLSearchParams(
        "qty=2.5&needed=2026-02-30&destination=ZZ&item=studio-headphones&sku=invalid",
      ),
    ),
  ).toMatchObject({ quantity: undefined, needed: "", country: "", sku: "" });
});
it("preserves supported criteria in sourcing and saved-search links", () => {
  const params = new URLSearchParams(
    "find=1&q=shaft+coupling&qty=50&needed=2099-01-10&destination=IN&customNotes=Steel",
  );
  const intent = parseIntent(params);
  expect(connectIntent(intent)).toContain("customNotes=Steel");
  expect(searchUrl(snapshot("search", params))).toContain("qty=50");
  expect(searchUrl(snapshot("search", params))).toContain("needed=2099-01-10");
});
it("keeps the selected retail variant and accounts for cart quantity", () => {
  const params = new URLSearchParams(
    "q=wireless+headphones&item=studio-headphones&sku=gift&qty=6",
  );
  const result = retailOptions(
    parseIntent(params),
    params,
    { "studio-headphones:gift": 2 },
    false,
  );
  expect(result[0]).toMatchObject({ variant: { id: "gift" }, available: 3 });
});
it("keeps incompatible manufacturing offers visible and evaluates MOQ on the same offer", () => {
  const intent = parseIntent(
    new URLSearchParams(
      "q=custom+machined+shaft+coupling&qty=1&destination=IN",
    ),
  );
  const matches = sourcingOptions(intent, false);
  expect(matches.length).toBeGreaterThan(0);
  expect(
    matches.some(({ warnings }) =>
      warnings.includes("Minimum order exceeds requested quantity"),
    ),
  ).toBe(true);
});
