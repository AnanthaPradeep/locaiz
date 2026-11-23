import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } =
    loadEnv(mode, process.cwd(), "VITE_");
  if (url || key) {
    if (!url || !key)
      throw new Error("Set both Supabase public configuration values.");
    const endpoint = new URL(url);
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(
      endpoint.hostname,
    );
    if (!local && endpoint.protocol !== "https:")
      throw new Error("Hosted Supabase must use HTTPS.");
    let localAnon = false;
    if (local && key.split(".").length === 3) {
      try {
        localAnon =
          JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
            .role === "anon";
      } catch {
        localAnon = false;
      }
    }
    if (!key.startsWith("sb_publishable_") && !localAnon) {
      throw new Error(
        "Supabase browser configuration requires a publishable key.",
      );
    }
  }
  return {
    base: process.env.PAGES_BASE_PATH
      ? `${process.env.PAGES_BASE_PATH}/`
      : "./",
    plugins: [react(), tailwind()],
  };
});
