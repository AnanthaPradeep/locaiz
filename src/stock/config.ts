export const stockUrl = import.meta.env.VITE_SUPABASE_URL;
export const stockKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const stockEnabled = Boolean(stockUrl && stockKey);
export const pilotId = import.meta.env.VITE_STOCK_PILOT || "nagercoil";

export function stockPath(product: string, variant = "Standard") {
  return `/account/stock-new?${new URLSearchParams({ product, variant })}`;
}
