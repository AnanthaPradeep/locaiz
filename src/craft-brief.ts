const craftFields = {
  basket: [["craftSize", "Basket size"], ["craftWeave", "Weave"], ["craftHandle", "Handle style"], ["craftColour", "Colour"]],
  painting: [["craftSize", "Painting dimensions"], ["craftFrame", "Frame"], ["craftFinish", "Finish"]],
  textile: [["craftLength", "Textile length"], ["craftColour", "Colour"], ["craftBorder", "Border style"]],
} as const;

const text = (fields: FormData, key: string) => String(fields.get(key) ?? "").trim();

export const craftDraftFields = [
  "regionalCraft", "sampleQuantity",
  ...new Set(Object.values(craftFields).flatMap((fields) => fields.map(([key]) => key))),
];

export function fieldsForCraft(craft: string | undefined) {
  if (!craft) return undefined;
  if (/basket/i.test(craft)) return craftFields.basket;
  if (/painting|mural/i.test(craft)) return craftFields.painting;
  if (/silk|handloom/i.test(craft)) return craftFields.textile;
  return undefined;
}

export function craftBriefLines(craft: string, fields: FormData) {
  const dimensions = (fieldsForCraft(craft) ?? []).flatMap(([key, label]) => {
    const value = text(fields, key);
    return value ? [label + ": " + value] : [];
  });
  const sample = text(fields, "sampleQuantity");
  if (sample && (!/^\d+$/.test(sample) || Number(sample) < 1 || Number(sample) > 1000000)) {
    throw new Error("Enter a whole sample quantity between 1 and 1,000,000.");
  }
  return [
    "Craft: " + craft,
    ...dimensions,
    ...(sample ? ["Sample quantity: " + Number(sample)] : []),
  ];
}

export function requestedSample(specifications: string) {
  return /^Sample quantity: ([1-9]\d*)$/m.exec(specifications)?.[1];
}

const sampleQuoteHeader = "Sample quote (separate from bulk)";

export function sampleQuoteTerms(fields: FormData, notes: string) {
  const cost = text(fields, "sampleCost");
  const lead = text(fields, "sampleLead");
  const delivery = text(fields, "sampleDelivery");
  if (!cost && !lead && !delivery) return notes;
  if (!/^\d+$/.test(cost) || !/^\d+$/.test(lead) || !["Shipping", "Pickup", "Shipping or pickup"].includes(delivery)) {
    throw new Error("Enter sample cost, lead time and a delivery option, or leave all three blank.");
  }
  const terms = [
    sampleQuoteHeader,
    "Sample cost (minor units): " + cost,
    "Sample lead time (days): " + lead,
    "Sample delivery: " + delivery,
    ...(notes ? ["", notes] : []),
  ].join("\n");
  if (terms.length > 2000) throw new Error("Shorten the custom terms to fit the sample quote.");
  return terms;
}

export function splitSampleQuote(terms = "") {
  const [header, cost, lead, delivery, separator, ...notes] = terms.split("\n");
  const costValue = /^Sample cost \(minor units\): (\d+)$/.exec(cost)?.[1];
  const leadValue = /^Sample lead time \(days\): (\d+)$/.exec(lead)?.[1];
  const deliveryValue = /^Sample delivery: (Shipping or pickup|Shipping|Pickup)$/.exec(delivery)?.[1];
  if (header !== sampleQuoteHeader || !costValue || !leadValue || !deliveryValue || (separator !== "" && separator !== undefined))
    return { notes: terms, cost: "", lead: "", delivery: "" };
  return { notes: notes.join("\n"), cost: costValue, lead: leadValue, delivery: deliveryValue };
}
