import { marketClient } from "./market-foundation";
import type { JourneySample } from "./sample-handoff";

export type ReorderSource = {
  id: string;
  thread_id: string;
  business_id: string;
  terms: {
    requirement?: {
      title?: string;
      specifications?: string;
      quantity?: number;
      destination?: string;
      unit?: string;
      currency?: string;
      custom?: boolean;
    };
    quote?: { currency?: string };
    approvedSample?: JourneySample;
  };
};

export const reorderHref = (id: string) => "/account/journey?reorder=" + id;

export function reorderSpecifications(source?: ReorderSource | null) {
  return (source?.terms.requirement?.specifications ?? "")
    .replace(/^Sample quantity: [1-9]\d*\r?\n?/gm, "").trim();
}

export async function readReorderSource(id: string, buyer?: string) {
  let query = marketClient!.from("journey_orders")
    .select("id,thread_id,business_id,terms")
    .eq("id", id);
  if (buyer) query = query.eq("buyer_id", buyer).eq("status", "completed");
  const { data, error } = await query.maybeSingle().overrideTypes<ReorderSource, { merge: false }>();
  if (error) throw error;
  return data;
}
