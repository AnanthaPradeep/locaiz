import { validateMarketplaceEnv } from "./src/market-environment";
import { symbolPath, themeStorageKey } from "./src/brand-geometry";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  validateMarketplaceEnv(loadEnv(mode, process.cwd(), "VITE_"), process.env.LOCAIZ_PUBLIC_DEMO_BUILD === "1");
  return {
    base: process.env.PAGES_BASE_PATH
      ? `${process.env.PAGES_BASE_PATH}/`
      : "./",
    plugins: [react(), tailwind(), {
      name: "locaiz-startup-brand",
      transformIndexHtml(html) {
        return html.replace("<!-- LOCAIZ_STARTUP_SYMBOL -->", `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="currentColor"/><path fill="var(--startup-background)" d="${symbolPath}"/></svg>`)
          .replace("__LOCAIZ_THEME_STORAGE__", themeStorageKey);
      },
    }],
  };
});
