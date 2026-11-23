import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1000 },
    trace: process.env.LOCAIZ_PILOT_PASSWORD ? "off" : "retain-on-failure",
    channel: process.env.LOCAIZ_BROWSER_CHANNEL,
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
