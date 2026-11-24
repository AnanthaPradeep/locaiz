import type { Activity } from "./store";
import {
  alertSampleOffer,
  offers,
  placeName,
  suppliers,
} from "./sourcing/catalog";
import type { Quote } from "./quote-evaluation";

export const basketFixtureId = "demo-basket-comparison";
const fees: Quote["fees"] = {
  Shipping: "pending",
  Packaging: "pending",
  Tax: "pending",
  Insurance: "pending",
  Duties: "pending",
  Other: "pending",
};
const basket: Omit<Quote, "id" | "supplier" | "moq" | "tiers" | "lead"> = {
  revision: 1,
  location: "Tamil Nadu, India",
  role: "Artisan supplier",
  currency: "INR",
  destinations: ["Chennai"],
  fees,
  custom: true,
};
const basketQuotes: Quote[] = [
  {
    ...basket,
    id: "basket-a",
    supplier: "Palm Weave Collective",
    moq: 100,
    tiers: [{ quantity: 100, minor: 18000 }],
    lead: 7,
    transit: 2,
    pickup: "Madurai",
    fees: { ...fees, Shipping: 60000 },
  },
  {
    ...basket,
    id: "basket-b",
    supplier: "Reed & Cane Workshop",
    moq: 50,
    tiers: [
      { quantity: 50, minor: 21000 },
      { quantity: 100, minor: 19000 },
    ],
    lead: 8,
  },
  {
    ...basket,
    id: "basket-c",
    supplier: "Delta Craft Co-op",
    moq: 25,
    tiers: [{ quantity: 25, minor: 19500 }],
    lead: 15,
    transit: 3,
    fees: {
      Shipping: 40000,
      Packaging: "included",
      Tax: "included",
      Insurance: "not applicable",
      Duties: "not applicable",
      Other: "not applicable",
    },
  },
  {
    ...basket,
    id: "basket-d",
    supplier: "Export Basket Studio",
    moq: 25,
    currency: "USD",
    tiers: [],
    lead: 6,
    destinations: ["US"],
    custom: false,
    validUntil: "2020-01-01",
  },
];

export function quotesFor(
  request: Activity,
  includeAlertSample: boolean,
): Quote[] {
  if (request.id === basketFixtureId) return basketQuotes;
  if (!request.sourcing) {
    return ["Regional Supply Studio", "Market Collective"].map(
      (supplier, index) => ({
        id: "demo-" + index,
        revision: 1,
        supplier,
        location: "Not supplied",
        role: "Demo supplier",
        currency: request.quoteContext?.budgetCurrency ?? "INR",
        moq: 1,
        tiers: [],
        lead: index ? 4 : 7,
        fees,
      }),
    );
  }
  const source = [...offers, alertSampleOffer].find(
    (offer) => offer.id === request.sourcing?.offerId,
  );
  if (!source) return [];
  return (includeAlertSample ? [...offers, alertSampleOffer] : offers)
    .filter((offer) => offer.productId === source.productId)
    .flatMap((offer) => {
      const supplier = suppliers.find((entry) => entry.id === offer.supplierId);
      return supplier
        ? [
            {
              id: offer.id,
              revision: 1,
              supplier: supplier.name,
              supplierId: supplier.id,
              role: supplier.roles.join(", "),
              location: placeName(supplier.base),
              currency: offer.currency,
              moq: offer.moq,
              tiers: offer.tiers,
              destinations: offer.shipping,
              fees,
              lead: offer.leadDays,
              custom: offer.custom,
              pickup: offer.pickup ? placeName(offer.pickup) : undefined,
              offerUrl: "/sourcing/product/" + offer.productId + "#" + offer.id,
            },
          ]
        : [];
    });
}
