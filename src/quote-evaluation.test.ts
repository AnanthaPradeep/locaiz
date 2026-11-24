import { expect, it } from "vitest";
import { evaluateQuote, type Quote } from "./quote-evaluation";

const quote: Quote = {
  id: "sample",
  supplier: "Demo",
  revision: 1,
  location: "India",
  role: "Artisan",
  currency: "JPY",
  moq: 25,
  destinations: ["IN"],
  lead: 5,
  transit: 3,
  custom: true,
  tiers: [
    { quantity: 100, minor: 120 },
    { quantity: 25, minor: 180 },
    { quantity: 50, minor: 150 },
  ],
  fees: {
    Shipping: 400,
    Tax: "included",
    Packaging: "included",
    Insurance: "not applicable",
    Duties: "not applicable",
    Other: "not applicable",
  },
  validUntil: "2026-12-31",
};
const now = new Date("2026-11-24T00:00:00Z");
const context = {
  quantity: 50,
  destination: "IN",
  deadline: "2026-12-04",
  custom: true,
};
it("selects the correct tier and uses integer minor units", () => {
  expect(evaluateQuote(quote, context, now)).toMatchObject({
    unit: 150,
    subtotal: 7500,
    total: 7900,
    timeline: "Fits requested timeline",
  });
});
it("keeps low-quantity offers visible without a subtotal", () => {
  expect(evaluateQuote(quote, { ...context, quantity: 24 }, now)).toMatchObject(
    {
      eligibility: "Does not meet requirement",
      subtotal: undefined,
      total: undefined,
      warnings: ["Does not meet requested quantity"],
    },
  );
});
it("distinguishes unknown shipping and transit from complete terms", () => {
  expect(
    evaluateQuote(
      { ...quote, fees: { Shipping: "pending" }, transit: undefined },
      context,
      now,
    ),
  ).toMatchObject({
    known: 7500,
    total: undefined,
    timeline: "Delivery estimate pending",
    completeness: "Partially quoted",
  });
});
it("uses production as a lower bound when transit is unknown", () => {
  expect(
    evaluateQuote({ ...quote, lead: 15, transit: undefined }, context, now)
      .timeline,
  ).toBe("Likely late");
});
it("reports unsupported destinations and expired quotes", () => {
  expect(
    evaluateQuote(
      { ...quote, validUntil: "2026-11-23" },
      { ...context, destination: "US" },
      now,
    ),
  ).toMatchObject({
    expired: true,
    eligibility: "Does not meet requirement",
    timeline: "Destination unsupported",
    total: undefined,
  });
});

it("treats unconfirmed required specifications as a question for the supplier", () => {
  expect(
    evaluateQuote(
      quote,
      { ...context, specifications: "Food-safe finish" },
      now,
    ),
  ).toMatchObject({
    eligibility: "Needs confirmation",
    warnings: ["Specifications unconfirmed"],
  });
});
