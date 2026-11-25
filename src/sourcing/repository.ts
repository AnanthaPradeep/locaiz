import type { SupabaseClient } from "@supabase/supabase-js";

export type PublishedOfferQuery = {
  category?: string;
  categoryNames?: string[];
  keyword?: string;
  businessId?: string;
  marketplaceOnly?: boolean;
  productId?: string;
  variantId?: string;
  supplierRole?: string;
  pickupId?: string;
  method?: string;
  currency?: string;
  maxMoq?: number;
  reviewedOnly?: boolean;
  verifiedOnly?: boolean;
  includeTiers?: boolean;
  order?: "newest" | "moq" | "price";
  page?: number;
};

export const publishedPageSize = 8;
export const supplierReviewLabels: Record<string, string> = {
  identity_reviewed: "Identity reviewed",
  documents_reviewed: "Documents reviewed",
  factory_reviewed: "Factory reviewed",
};

type PublishedOffer = {
  id: string;
  product_id: string;
  variant_id: string;
  method: string;
  currency: string;
  unit_price_minor: number | null;
  minimum_quantity: number;
  pickup_id: string | null;
  custom_order: boolean;
  shipping_countries: string[];
  sourcing_price_tiers?: { quantity: number; unit_price_minor: number }[];
  lead_days: number | null;
  sourcing_variants: { sourcing_products: { name: string; category_id: string; sourcing_categories?: {name:string} } };
  sourcing_businesses: { id: string; name: string; verification: string };
};

export function publishedCatalogue(client: SupabaseClient) {
  return {
    async offers(filters: PublishedOfferQuery) {
      const page = Number.isSafeInteger(filters.page)
        ? Math.max(1, Math.min(10000, filters.page!))
        : 1;
      const start = (page - 1) * publishedPageSize;
      let query = client.from("sourcing_offers").select(
        "id,product_id,variant_id,method,currency,unit_price_minor,minimum_quantity,pickup_id,lead_days,custom_order,shipping_countries,sourcing_variants!inner(sourcing_products!inner(name,category_id,sourcing_categories!inner(name))),sourcing_businesses!inner(id,name,verification)" + (filters.includeTiers ? ",sourcing_price_tiers(quantity,unit_price_minor)" : ""),
        { count: "exact" },
      ).eq("published", true).eq("sourcing_businesses.published", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      if (filters.marketplaceOnly) query = query.eq("sourcing_variants.sourcing_products.publication_state","published");
      if (filters.category) query = query.eq("sourcing_variants.sourcing_products.category_id", filters.category);
      if (filters.categoryNames?.length) query = query.in("sourcing_variants.sourcing_products.sourcing_categories.name",filters.categoryNames);
      if (filters.keyword) query = query.ilike("sourcing_variants.sourcing_products.name","%"+filters.keyword.replace(/[%_]/g, "")+"%");
      if (filters.businessId) query = query.eq("business_id",filters.businessId);
      if (filters.productId) query = query.eq("product_id", filters.productId);
      if (filters.variantId) query = query.eq("variant_id", filters.variantId);
      if (filters.method) query = query.eq("method", filters.method);
      if (filters.pickupId) query = query.eq("pickup_id", filters.pickupId);
      if (filters.supplierRole) query = query.contains("sourcing_businesses.roles", [filters.supplierRole]);
      if (Number.isSafeInteger(filters.maxMoq) && filters.maxMoq! > 0)
        query = query.lte("minimum_quantity", filters.maxMoq!);
      if (filters.verifiedOnly) query = query.eq("sourcing_businesses.trust_state", "verified");
      if (filters.reviewedOnly)
        query = query.in("sourcing_businesses.verification", Object.keys(supplierReviewLabels));
      if (filters.currency) query = query.eq("currency", filters.currency);
      if (filters.order === "price" && filters.currency) query = query.order("unit_price_minor", { nullsFirst: false });
      else if (filters.order === "moq") query = query.order("minimum_quantity");
      else query = query.order("created_at", { ascending: false });
      const { data, count, error } = await query.order("id").range(start, start + publishedPageSize - 1)
        .overrideTypes<PublishedOffer[], { merge: false }>();
      if (error) throw error;
      return { items: data, total: count ?? 0, page };
    },
    async categories() {
      const { data, error } = await client.from("sourcing_categories")
        .select("id,name,parent_id").order("name").order("id");
      if (error) throw error;
      return data;
    },
  };
}
