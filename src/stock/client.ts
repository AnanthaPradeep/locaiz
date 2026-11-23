import { createClient } from "@supabase/supabase-js";
import { pilotId, stockKey, stockUrl } from "./config";

export const stockClient =
  stockUrl && stockKey ? createClient(stockUrl, stockKey) : null;

export interface RequestRow {
  id: string;
  product_id: string;
  variant: string;
  quantity: number;
  message: string | null;
  preferred_pickup: string | null;
  created_at: string;
  expires_at: string;
  cancelled_at: string | null;
}

export interface Assignment {
  id: string;
  business_id: string;
  shop_name: string;
  is_demo: boolean;
  status: "pending" | "available" | "out_of_stock";
  price: number | null;
  currency: string | null;
  ready_at: string | null;
  available_quantity: number | null;
  instructions: string | null;
  note: string | null;
  quote_expires_at: string | null;
  restock_at: string | null;
  responded_at: string | null;
}

export type StockRequest = RequestRow & { stock_request_shops: Assignment[] };
const requestFields =
  "id,product_id,variant,quantity,message,preferred_pickup,created_at,expires_at,cancelled_at";
const assignmentFields =
  "id,business_id,shop_name,is_demo,status,price,currency,ready_at,available_quantity,instructions,note,quote_expires_at,restock_at,responded_at";

export async function readRequests(
  user: string,
  seller: boolean,
): Promise<StockRequest[]> {
  const db = stockClient!;
  const query = db
    .from("stock_requests")
    .select(
      `${requestFields},stock_request_shops${seller ? "!inner" : ""}(${assignmentFields})`,
    )
    .order("created_at", { ascending: false });
  if (seller) {
    const membership = await db.rpc("my_stock_businesses");
    if (membership.error) throw membership.error;
    if (!membership.data?.length) return [];
    query.in("stock_request_shops.business_id", membership.data);
  } else {
    query.eq("buyer_id", user);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as StockRequest[];
}

export async function readPilot(product: string, variant: string) {
  const db = stockClient!;
  const [pilot, eligibility, shops] = await Promise.all([
    db
      .from("stock_pilots")
      .select("city,category")
      .eq("id", pilotId)
      .maybeSingle(),
    db
      .from("stock_products")
      .select("product_id")
      .eq("pilot_id", pilotId)
      .eq("product_id", product)
      .eq("variant", variant)
      .maybeSingle(),
    db
      .from("stock_businesses")
      .select("id,name,is_demo")
      .eq("pilot_id", pilotId)
      .order("name"),
  ]);
  const error = pilot.error || eligibility.error || shops.error;
  if (error) throw error;
  return {
    pilot: pilot.data,
    eligible: Boolean(eligibility.data),
    shops: shops.data ?? [],
  };
}

export function requestStatus(request: StockRequest, now: number) {
  if (request.cancelled_at) return "Cancelled";
  if (
    Date.parse(request.expires_at) <= now &&
    request.stock_request_shops.some((shop) => shop.status === "pending")
  )
    return "Expired";
  const replies = request.stock_request_shops.filter(
    (shop) => shop.status !== "pending",
  ).length;
  if (replies === 0) return "Pending";
  return replies === request.stock_request_shops.length
    ? "All responded"
    : "Partially responded";
}
