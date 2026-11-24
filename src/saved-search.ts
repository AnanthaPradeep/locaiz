import { findListings } from "./catalog";
import { catalogueFilters } from "./catalogue-filters";
import { searchOffers } from "./sourcing/catalog";

export type Scope = "shop" | "search" | "sourcing";
export type Criteria = { scope: Scope; query: string; preferences: string };
export type Match = { id: string; title: string; reason: string; href: string };
export type SavedSearch = Criteria & {
  id: string;
  name: string;
  enabled: boolean;
  seen: string[];
  revision: number;
  checked: string;
};
export type MatchAlert = Match & {
  key: string;
  searchId: string;
  searchName: string;
  date: string;
  read: boolean;
};

const retailKeys =
  "q category country distance minPrice maxPrice maxMoq brand material feature variant subcategory countryOfSupplier supplierCity origin supplierType method pickup available community";
const sourcingKeys =
  "q place category role method destination pickup custom maxMoq";
const repeatable = new Set(
  "category brand material feature variant subcategory countryOfSupplier supplierCity origin supplierType method pickup available community".split(
    " ",
  ),
);
const numeric = new Set(["distance", "minPrice", "maxPrice", "maxMoq"]);

export const scopeNames = {
  shop: "Shop",
  search: "Universal Search",
  sourcing: "Global Atlas",
};
export function snapshot(scope: Scope, params: URLSearchParams): Criteria {
  if (!Object.hasOwn(scopeNames, scope))
    throw new Error("Choose a supported marketplace.");
  const criteria = new URLSearchParams();
  for (const key of (scope === "sourcing" ? sourcingKeys : retailKeys)
    .split(" ")
    .sort()) {
    const values =
      scope !== "sourcing" && repeatable.has(key)
        ? params.getAll(key)
        : [params.get(key) ?? ""];
    for (const value of [
      ...new Set(values.filter((value) => value.trim())),
    ].sort()) {
      if (value.length > 180)
        throw new Error("Search values must be 180 characters or fewer.");
      if (
        numeric.has(key) &&
        (!/^\d+(\.\d+)?$/.test(value) ||
          !Number.isFinite(Number(value)) ||
          (key === "maxMoq" && !Number.isSafeInteger(Number(value))))
      )
        throw new Error("Check the numeric filters.");
      criteria.append(key, value);
    }
  }
  if (
    Number(criteria.get("minPrice")) > Number(criteria.get("maxPrice")) &&
    criteria.has("maxPrice")
  )
    throw new Error("Minimum price must be at or below maximum price.");
  if (!criteria.size)
    throw new Error("Enter a keyword or select a filter first.");
  if (criteria.toString().length > 2500)
    throw new Error("Save fewer filters for this search.");
  const preferences = new URLSearchParams();
  for (const key of ["view", "sort"]) {
    const value = params.get(key);
    if (
      value &&
      ["list", "grid", "map", "price", "price-desc", "newest", "name"].includes(
        value,
      )
    )
      preferences.set(key, value);
  }
  return {
    scope,
    query: criteria.toString(),
    preferences: preferences.toString(),
  };
}

export function searchUrl(criteria: Criteria) {
  return (
    "/" +
    criteria.scope +
    "?" +
    [criteria.query, criteria.preferences].filter(Boolean).join("&")
  );
}

export function evaluate(
  criteria: Criteria,
  activeDeal: boolean,
  includeAlertSample = false,
): Match[] {
  const params = new URLSearchParams(criteria.query);
  if (criteria.scope === "sourcing") {
    return searchOffers(params, includeAlertSample).map(
      ({ offer, supplier, product }) => ({
        id: offer.id,
        title: product.name + " · " + supplier.name,
        reason: "Supplier offer matches your saved criteria",
        href: "/sourcing/product/" + product.id + "#" + offer.id,
      }),
    );
  }
  const items = findListings(
    params.get("q") ?? "",
    criteria.scope === "shop" ? "shop" : undefined,
    undefined,
    undefined,
    includeAlertSample,
  );
  return catalogueFilters(items, params, activeDeal).filtered.map((item) => ({
    id: item.section + "/" + item.id,
    title: item.name,
    reason: item.category + " · matches your saved criteria",
    href: "/" + item.section + "/" + item.id,
  }));
}

export function compareMatches(
  search: SavedSearch,
  matches: Match[],
  date: string,
) {
  const seen = new Set(search.seen);
  const alerts: MatchAlert[] = [];
  for (const match of matches) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    alerts.push({
      ...match,
      key: JSON.stringify([search.id, search.revision, match.id]),
      searchId: search.id,
      searchName: search.name,
      date,
      read: false,
    });
  }
  return { search: { ...search, seen: [...seen], checked: date }, alerts };
}
