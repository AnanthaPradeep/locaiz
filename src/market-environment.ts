type Environment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_MARKETPLACE_FOUNDATION?: string;
};

export function validateMarketplaceEnv(env: Environment, publicDemo: boolean) {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key, VITE_MARKETPLACE_FOUNDATION: foundation } = env;
  if (foundation && !["0", "1"].includes(foundation))
    throw new Error("Marketplace foundation flag must be 0 or 1.");
  if (publicDemo && (url || key || foundation === "1"))
    throw new Error("Public demo builds require disconnected marketplace configuration.");
  if (!url && !key && foundation !== "1") return;
  if (!url || !key) throw new Error("Set both Supabase public configuration values.");
  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error("Invalid Supabase project URL.");
  }
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname);
  if ((endpoint.protocol !== "https:" && !(local && endpoint.protocol === "http:")) ||
    endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    endpoint.pathname !== "/") {
    throw new Error("Use a Supabase project origin over HTTPS or local HTTP.");
  }
  let localAnon = false;
  if (local && key.split(".").length === 3) {
    try {
      localAnon = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon";
    } catch {
      localAnon = false;
    }
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !localAnon)
    throw new Error("Supabase browser configuration requires a publishable key.");
}
