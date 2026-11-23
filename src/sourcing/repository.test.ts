import { createClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { publishedCatalogue } from "./repository";

it("queries a bounded page of published offers with trusted reviews", async () => {
  const transport = vi.fn(async (input: RequestInfo | URL) => {
    const query = new URL(input.toString()).searchParams;
    expect(query.get("published")).toBe("eq.true");
    expect(query.get("sourcing_businesses.published")).toBe("eq.true");
    expect(query.get("sourcing_businesses.verification")).toBe(
      "in.(identity_reviewed,documents_reviewed,factory_reviewed)",
    );
    expect(query.get("sourcing_variants.sourcing_products.category_id")).toBe("eq.electronics");
    expect(query.get("limit")).toBe("8");
    expect(query.get("offset")).toBe("8");
    expect(query.get("order")).toBe("minimum_quantity.asc,id.asc");
    return new Response("[]", {
      headers: { "Content-Type": "application/json", "Content-Range": "*/10" },
    });
  });
  const supabase = createClient("https://catalogue.example", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: transport },
  });
  const result = await publishedCatalogue(supabase).offers({
    page: 2, category: "electronics", order: "moq", reviewedOnly: true,
  });
  expect(result).toEqual({ items: [], total: 10, page: 2 });
  expect(transport).toHaveBeenCalledOnce();
});
