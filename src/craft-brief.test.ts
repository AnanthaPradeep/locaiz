import { describe, expect, it } from "vitest";
import { craftBriefLines, fieldsForCraft, requestedSample, sampleQuoteTerms, splitSampleQuote } from "./craft-brief";

describe("custom craft brief", () => {
  it("renders only the selected craft details and keeps sample quantity separate", () => {
    const fields = new FormData();
    fields.set("craftSize", "30 cm");
    fields.set("craftHandle", "Two handles");
    fields.set("craftFrame", "Teak frame");
    fields.set("sampleQuantity", "2");
    const description = craftBriefLines("Chettinad baskets", fields).join("\n");
    expect(description).toBe("Craft: Chettinad baskets\nBasket size: 30 cm\nHandle style: Two handles\nSample quantity: 2");
    expect(requestedSample(description)).toBe("2");
    expect(fieldsForCraft("Kasavu handloom")).toContainEqual(["craftBorder", "Border style"]);
    expect(fieldsForCraft("Swamimalai bronze")).toBeUndefined();
    fields.set("sampleQuantity", "1.5");
    expect(() => craftBriefLines("Chettinad baskets", fields)).toThrow(/whole sample quantity/);
  });

  it("keeps sample terms readable, reversible, and compatible with old quote notes", () => {
    const fields = new FormData();
    fields.set("sampleCost", "0");
    expect(() => sampleQuoteTerms(fields, "")).toThrow(/lead time/);
    fields.set("sampleLead", "5");
    fields.set("sampleDelivery", "Pickup");
    const quote = sampleQuoteTerms(fields, "Bulk notes\nSecond line");
    expect(splitSampleQuote(quote)).toEqual({ cost: "0", lead: "5", delivery: "Pickup", notes: "Bulk notes\nSecond line" });
    expect(splitSampleQuote("Legacy quote notes").notes).toBe("Legacy quote notes");
  });
});
