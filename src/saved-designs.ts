import { marketClient } from "./market-foundation";

export type SavedDesign = {
  id: string;
  name: string;
  specifications: string;
  source_order_id: string;
  copied_from: string | null;
};

const designFields = "id,name,specifications,source_order_id,copied_from";
export const designPageSize = 12;
export const savedDesignsHref = "/account/buying-journey?view=designs";
export const designRfqHref = (id: string) => "/account/journey?design=" + id;

export async function readSavedDesign(id: string, user: string) {
  const { data, error } = await marketClient!.from("journey_saved_designs")
    .select(designFields).eq("id", id).eq("buyer_id", user)
    .maybeSingle().overrideTypes<SavedDesign, { merge: false }>();
  if (error) throw error;
  return data;
}

export async function listSavedDesigns(user: string, search: string, page: number) {
  let query = marketClient!.from("journey_saved_designs")
    .select(designFields, { count: "exact" }).eq("buyer_id", user);
  if (search) query = query.textSearch("search_document", search, { config: "simple", type: "plain" });
  const start = page * designPageSize;
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("id")
    .range(start, start + designPageSize - 1).overrideTypes<SavedDesign[], { merge: false }>();
  if (error) throw error;
  return { designs: data, count: count ?? 0 };
}
