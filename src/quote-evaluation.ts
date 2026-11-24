export type QuoteContext = {
  quantity?: number;
  unit?: string;
  destination?: string;
  deadline?: string;
  custom?: boolean;
  specifications?: string;
};
export const feeLabels = [
  "Shipping",
  "Packaging",
  "Tax",
  "Insurance",
  "Duties",
  "Other",
] as const;
type Fee = number | "included" | "not applicable" | "pending";
export type Quote = {
  id: string;
  revision: number;
  supplier: string;
  supplierId?: string;
  location: string;
  role: string;
  offerUrl?: string;
  currency: string;
  moq: number;
  tiers: readonly { quantity: number; minor: number }[];
  destinations?: readonly string[];
  fees: Record<string, Fee>;
  lead?: number;
  transit?: number;
  validUntil?: string;
  pickup?: string;
  custom?: boolean;
  specificationsConfirmed?: boolean;
};

function safeAmount(amount: number) {
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : undefined;
}

export function evaluateQuote(quote: Quote, context: QuoteContext, now: Date) {
  const { quantity, destination, deadline } = context;
  const validQuantity =
    typeof quantity === "number" &&
    Number.isSafeInteger(quantity) &&
    quantity > 0;
  const comparableUnit = !context.unit || context.unit === "units";
  const meetsQuantity = comparableUnit && validQuantity && quantity >= quote.moq;
  const tier = meetsQuantity
    ? quote.tiers.reduce<(typeof quote.tiers)[number] | undefined>(
        (best, current) =>
          current.quantity <= quantity &&
          (!best || current.quantity > best.quantity)
            ? current
            : best,
        undefined,
      )
    : undefined;
  const unit = tier && safeAmount(tier.minor);
  const subtotal =
    unit !== undefined && validQuantity
      ? safeAmount(unit * quantity)
      : undefined;
  const fees = feeLabels.map((label) => quote.fees[label] ?? "pending");
  const completeFees = fees.every(
    (fee) =>
      fee === "included" ||
      fee === "not applicable" ||
      (typeof fee === "number" && safeAmount(fee) !== undefined),
  );
  const knownFees = fees.reduce<number>(
    (sum, fee) => sum + (typeof fee === "number" ? (safeAmount(fee) ?? 0) : 0),
    0,
  );
  const known =
    subtotal === undefined ? undefined : safeAmount(subtotal + knownFees);
  const delivery =
    destination && quote.destinations
      ? quote.destinations.some(
          (value) => value.toLowerCase() === destination.trim().toLowerCase(),
        )
      : undefined;
  const date = now.toISOString().slice(0, 10);
  const expired = !!quote.validUntil && quote.validUntil < date;
  const estimate =
    quote.lead !== undefined && quote.transit !== undefined
      ? quote.lead + quote.transit
      : undefined;
  const availableDays = deadline
    ? Math.floor((Date.parse(deadline) - Date.parse(date)) / 86400000)
    : undefined;
  const late =
    availableDays !== undefined &&
    (estimate ?? quote.lead ?? 0) > availableDays;
  const timeline =
    delivery === false
      ? "Destination unsupported"
      : !deadline
        ? "Deadline not specified"
        : late
          ? "Likely late"
          : estimate === undefined || delivery !== true
            ? "Delivery estimate pending"
            : "Fits requested timeline";
  const warnings: string[] = [];
  const questions: string[] = [];
  if (!validQuantity) warnings.push("Requested quantity not specified");
  if (!comparableUnit) warnings.push("Requested unit of measure needs confirmation");
  if (comparableUnit && validQuantity && !meetsQuantity) {
    warnings.push("Does not meet requested quantity");
    questions.push("Can you supply " + quantity + " units?");
  }
  if (delivery === false) warnings.push("Delivery destination unsupported");
  if (delivery === undefined) warnings.push("Delivery eligibility unconfirmed");
  if (
    !Object.hasOwn(quote.fees, "Shipping") ||
    quote.fees.Shipping === "pending"
  )
    warnings.push("Shipping awaiting quotation");
  if (
    delivery !== true ||
    !Object.hasOwn(quote.fees, "Shipping") ||
    quote.fees.Shipping === "pending"
  )
    questions.push(
      "Can you confirm delivery and shipping cost to " +
        (destination || "the requested destination") +
        "?",
    );
  if (context.custom && quote.custom !== true) {
    warnings.push(
      quote.custom === false
        ? "Customisation unsupported"
        : "Customisation unconfirmed",
    );
    questions.push("Can you meet the requested customisation?");
  }
  if (
    context.specifications?.trim() &&
    quote.specificationsConfirmed !== true
  ) {
    warnings.push(
      quote.specificationsConfirmed === false
        ? "Specifications unsupported"
        : "Specifications unconfirmed",
    );
    questions.push("Can you confirm the requested product specifications?");
  }
  if (late) warnings.push("Likely late");
  if (timeline === "Delivery estimate pending" || late)
    questions.push("Can you confirm the delivery date?");
  if (expired) warnings.push("Quotation expired");
  if (!quote.validUntil) questions.push("How long is this quotation valid?");
  if (unit === undefined && meetsQuantity)
    questions.push("What is the unit price for the requested quantity?");
  if (quote.fees.Tax === "pending") questions.push("Are taxes included?");
  const ineligible =
    (comparableUnit && validQuantity && !meetsQuantity) ||
    delivery === false ||
    late ||
    expired ||
    (context.custom && quote.custom === false) ||
    (context.specifications?.trim() && quote.specificationsConfirmed === false);
  const eligibility = ineligible
    ? "Does not meet requirement"
    : !comparableUnit || !validQuantity ||
        delivery !== true ||
        (context.custom && quote.custom !== true) ||
        (context.specifications?.trim() &&
          quote.specificationsConfirmed !== true) ||
        timeline === "Delivery estimate pending"
      ? "Needs confirmation"
      : "Meets requirement";
  const total = completeFees && delivery === true ? known : undefined;
  return {
    eligibility,
    timeline,
    unit,
    subtotal,
    known,
    total,
    estimate,
    expired,
    warnings,
    questions,
    completeness:
      total !== undefined
        ? "Fully quoted"
        : subtotal !== undefined
          ? "Partially quoted"
          : "Awaiting essential terms",
  };
}
