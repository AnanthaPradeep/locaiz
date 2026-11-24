export const stockUrl = import.meta.env.VITE_SUPABASE_URL;
export const stockKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const stockEnabled = Boolean(stockUrl && stockKey);
export const pilotId = import.meta.env.VITE_STOCK_PILOT || "nagercoil";

export function stockPath(product: string, variant = "Standard", context?: { quantity?: number; pickup?: string; note?: string }) {
  const params = new URLSearchParams({ product, variant });
  if (context?.quantity) params.set("qty", String(context.quantity));
  if (context?.pickup) params.set("pickupDate", context.pickup);
  if (context?.note) params.set("customNotes", context.note);
  return "/account/stock-new?" + params;
}
