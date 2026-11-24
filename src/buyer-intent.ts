import { findListings, type Listing } from "./catalog";
import {
  availableCartUnits,
  retailVariants,
  productSourcing,
} from "./product-commerce";
import { places, searchOffers, unitPrice } from "./sourcing/catalog";
import { catalogueFilters } from "./catalogue-filters";

export const intentKeys = [
  "qty",
  "city",
  "destination",
  "needed",
  "pickupDate",
  "customNotes",
  "item",
  "sku",
  "budget",
  "currency",
  "uom",
] as const;
export const unitOptions = ["units", "pairs", "sets"] as const;

function dateValue(raw: string | null) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const time = new Date(raw);
  return Number.isFinite(time.getTime()) &&
    time.toISOString().slice(0, 10) === raw
    ? raw
    : "";
}

export function parseIntent(params: URLSearchParams) {
  const item = (params.get("item") ?? "").slice(0, 100);
  const listing = item
    ? findListings("", "shop").find((entry) => entry.id === item)
    : undefined;
  const sku =
    listing &&
    retailVariants(listing).find((entry) => entry.id === params.get("sku"));
  const quantity = Number(params.get("qty"));
  const budget = Number(params.get("budget"));
  const unit =
    unitOptions.find((value) => value === params.get("uom")) ?? "units";
  const country =
    places.find(
      (place) => place.country && place.country === params.get("destination"),
    )?.country ?? "";
  const currency =
    ["INR", "USD", "CNY", "EUR"].find(
      (value) => value === params.get("currency"),
    ) ?? "INR";
  return {
    query: (params.get("q") ?? "").trim().slice(0, 120),
    quantity:
      Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 1000000
        ? quantity
        : undefined,
    city: (params.get("city") ?? "").trim().slice(0, 100),
    country,
    unit,
    currency,
    needed: dateValue(params.get("needed")),
    pickupDate: dateValue(params.get("pickupDate")),
    notes: (params.get("customNotes") ?? "").trim().slice(0, 500),
    item: listing?.id ?? "",
    sku: sku?.id ?? "",
    budget:
      Number.isFinite(budget) && budget > 0 && budget <= 1e12
        ? budget
        : undefined,
  };
}

export type BuyerIntent = ReturnType<typeof parseIntent>;

export function intentParams(intent: BuyerIntent) {
  return new URLSearchParams(
    Object.entries({
      q: intent.query,
      qty: intent.quantity,
      city: intent.city,
      destination: intent.country,
      uom: intent.unit === "units" ? "" : intent.unit,
      needed: intent.needed,
      pickupDate: intent.pickupDate,
      customNotes: intent.notes,
      item: intent.item,
      sku: intent.sku,
      budget: intent.budget,
      currency: intent.budget === undefined ? "" : intent.currency,
    }).flatMap(([key, value]) => (value ? [[key, String(value)]] : [])),
  );
}

export function connectIntent(intent: BuyerIntent, offer?: string) {
  const params = intentParams(intent);
  params.set("find", "1");
  if (offer) params.set("offer", offer);
  return "/connect?" + params;
}

function catalogueQuery(query: string) {
  return query
    .replace(/\bbaskets\b/gi, "basket")
    .replace(/\blamps\b/gi, "lamp");
}

export function retailOptions(
  intent: BuyerIntent,
  params: URLSearchParams,
  cart: Record<string, number>,
  deal: boolean,
) {
  if (!intent.query && !intent.item) return [];
  const listings = intent.item
    ? findListings("", "shop").filter((item) => item.id === intent.item)
    : findListings(catalogueQuery(intent.query), "shop");
  return catalogueFilters(listings, params, deal)
    .filtered.filter((item) => !item.quoteOnly)
    .map((item) => {
      const variants = retailVariants(item);
      const variant =
        variants.find((option) => option.id === intent.sku) ??
        variants.find(
          (option) =>
            availableCartUnits(option, cart) >= (intent.quantity ?? 1),
        ) ??
        variants[0];
      return {
        item,
        variant,
        available: Math.min(
          availableCartUnits(variant, cart),
          Math.max(0, 99 - (cart[variant.cartKey] ?? 0)),
        ),
      };
    });
}

export function sourcingOptions(intent: BuyerIntent, sample: boolean) {
  if (!intent.query && !intent.item) return [];
  const related = intent.item
    ? productSourcing(intent.item, intent.sku || "standard").product
    : undefined;
  const query = new URLSearchParams({
    q: related ? "" : catalogueQuery(intent.query).replace(/^custom\s+/i, ""),
  });
  const matches = searchOffers(query, sample).filter(
    (match) => !related || match.product.id === related.id,
  );
  return matches.map((match) => {
    const { offer } = match;
    const warnings: string[] = [];
    if (intent.unit !== "units")
      warnings.push("Requested unit of measure needs confirmation");
    if (
      intent.unit === "units" &&
      intent.quantity !== undefined &&
      intent.quantity < offer.moq
    )
      warnings.push("Minimum order exceeds requested quantity");
    if (intent.country && !offer.shipping.includes(intent.country))
      warnings.push("Destination not listed");
    if (intent.notes && offer.custom !== true)
      warnings.push("Customisation needs supplier confirmation");
    if (
      intent.needed &&
      Date.parse(intent.needed) -
        Date.parse(new Date().toISOString().slice(0, 10)) <
        offer.leadDays * 86400000
    )
      warnings.push("Production alone exceeds the requested timeline");
    return {
      ...match,
      warnings,
      unit:
        intent.unit !== "units" || intent.quantity === undefined
          ? undefined
          : unitPrice(offer, intent.quantity),
    };
  });
}

export function productIntent(
  intent: BuyerIntent,
  item: Listing,
  variantId: string,
) {
  return {
    ...intent,
    query: intent.query || item.name,
    item: item.id,
    sku: variantId,
  };
}
