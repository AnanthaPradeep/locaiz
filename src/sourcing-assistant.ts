import { z } from "zod";

const text = (limit: number) => z.string().trim().max(limit);
export const sourcingDraftSchema = z.object({
  category: text(100),
  description: text(120),
  quantity: z.number().int().min(1).max(1000000).nullable(),
  unit: z.enum(["units", "sets", "pairs", ""]),
  customisation: text(500),
  materials: text(300),
  dimensions: text(300),
  destination: text(120),
  budget: z.number().positive().max(1e9).nullable(),
  currency: z.union([z.literal(""), z.string().regex(/^[A-Z]{3}$/)]),
  deadline: z
    .string()
    .refine(
      (value) =>
        !value ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
          Number.isFinite(Date.parse(value)) &&
          new Date(value).toISOString().slice(0, 10) === value),
    ),
});
export type SourcingDraft = z.infer<typeof sourcingDraftSchema>;

export interface SourcingDraftProvider {
  extract(brief: string): Promise<unknown>;
}

const fieldValue = (brief: string, pattern: RegExp) =>
  brief.match(pattern)?.[1]?.trim() ?? "";
const numeric = (value: string) =>
  value ? Number(value.replaceAll(",", "")) : null;

export const localSourcingProvider: SourcingDraftProvider = {
  async extract(brief) {
    const request = brief.match(
      /^(?:(?:i|we) (?:need|want|require)\s+)?([\d,]+)\s+(?:(units|sets|pairs)\s+(?:of\s+)?)?([^,;\n]+?)(?=\s+with\b|\s+(?:delivery|deliver|budget|by)\b|[;,\n]|$)/i,
    );
    const budget = brief.match(
      /\bbudget\s*:?\s*(?:(INR|USD|EUR|GBP|CNY|\u20b9|\$|\u20ac)\s*)?([\d,]+(?:\.\d{1,2})?)(?:\s+(INR|USD|EUR|GBP|CNY)\b)?(?![\d.,])/i,
    );
    const rawCurrency = (budget?.[1] ?? budget?.[3] ?? "").toUpperCase();
    const currency =
      rawCurrency === "\u20b9"
        ? "INR"
        : rawCurrency === "\u20ac"
          ? "EUR"
          : rawCurrency === "$"
            ? ""
            : rawCurrency;
    const deadline = fieldValue(
      brief,
      /\b(?:by|deadline:?)\s+(\d{4}-\d{2}-\d{2})(?!\d)/i,
    );
    const quantity = numeric(request?.[1] ?? "");
    const amount = numeric(budget?.[2] ?? "");
    return {
      category: fieldValue(brief, /\bcategory:\s*([^,;\n]+)/i).slice(0, 100),
      description: (
        request?.[3]?.trim() ?? fieldValue(brief, /^product:\s*([^,;\n]+)/i)
      ).slice(0, 120),
      quantity: quantity && quantity <= 1000000 ? quantity : null,
      unit: request?.[2]?.toLowerCase() ?? "",
      customisation: fieldValue(
        brief,
        /\b(?:with|customisation:)\s+([^,;\n]+?)(?=\s+delivery\b|\s+budget\b|[;,\n]|$)/i,
      ).slice(0, 500),
      materials: fieldValue(brief, /\bmaterials?:\s*([^,;\n]+)/i).slice(0, 300),
      dimensions: fieldValue(brief, /\bdimensions?:\s*([^,;\n]+)/i).slice(
        0,
        300,
      ),
      destination: fieldValue(
        brief,
        /\b(?:delivery to|deliver to|destination:)\s+([^,;\n]+?)(?=\s+by\b|\s+budget\b|[;,\n]|$)/i,
      ).slice(0, 120),
      budget: amount && amount <= 1e9 ? amount : null,
      currency,
      deadline: sourcingDraftSchema.shape.deadline.safeParse(deadline).success
        ? deadline
        : "",
    };
  },
};

export async function buildSourcingDraft(
  brief: string,
  provider = localSourcingProvider,
) {
  const validated = z.string().trim().min(3).max(2000).parse(brief);
  return sourcingDraftSchema.parse(await provider.extract(validated));
}

export function sourcingSpecifications(draft: SourcingDraft) {
  return [
    ["Category", draft.category],
    ["Materials", draft.materials],
    ["Dimensions", draft.dimensions],
    ["Customisation", draft.customisation],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => label + ": " + value)
    .join("\n");
}
