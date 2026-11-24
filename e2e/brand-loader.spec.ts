import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(
    "uses saved " +
      theme +
      " on first paint and releases the direct Shop route",
    async ({ page }) => {
      const dark = theme === "dark";
      await page.setViewportSize({ width: dark ? 1440 : 390, height: 900 });
      await page.emulateMedia({
        reducedMotion: dark ? "reduce" : "no-preference",
      });
      await page.addInitScript((theme) => {
        localStorage.setItem(
          "locaiz-demo-v1",
          JSON.stringify({ state: { theme }, version: 0 }),
        );
      }, theme);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(/\/assets\/marketplace-[^/]+\.js$/, async (route) => {
        await gate;
        await route.continue();
      });
      try {
        await page.goto("/#/shop", { waitUntil: "commit" });
        const loader = page.locator("#startup-loader");
        await expect(loader).toBeVisible();
        await expect(loader.getByText("Loading LOCAIZ")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(loader).toHaveCSS(
          "background-color",
          dark ? "rgb(10, 10, 10)" : "rgb(255, 246, 236)",
        );
        await expect(page.locator("#root")).toHaveAttribute("inert", "");
        expect(
          (await loader.locator("svg").boundingBox())?.width,
        ).toBeGreaterThanOrEqual(dark ? 175 : 96);
        if (dark)
          await expect(loader.locator(".startup-spinner")).toHaveCSS(
            "animation-name",
            "none",
          );
        await page.screenshot({
          path: test.info().outputPath("loading-" + theme + ".png"),
        });
        for (const width of [360, 390, 768, 1024, 1440, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          const bounds = await loader.locator("svg").boundingBox();
          expect(bounds?.width).toBeGreaterThanOrEqual(
            width < 700 ? 96 : width < 1024 ? 140 : 175,
          );
          expect(bounds?.width).toBeLessThanOrEqual(210);
        }
      } finally {
        release();
      }
      await expect(
        page.getByRole("heading", { name: "Shop", level: 1 }),
      ).toBeVisible();
      await expect(page.locator("#startup-loader")).toHaveCount(0);
      await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
      const ink = dark ? "rgb(255, 246, 236)" : "rgb(10, 10, 10)";
      for (const logo of await page
        .getByRole("link", { name: "LOCAIZ home" })
        .all()) {
        await expect(logo.locator(".brand-symbol rect")).toHaveCSS("fill", ink);
        await expect(logo.locator(".wordmark path")).toHaveCSS("fill", ink);
      }
    },
  );
}

test("switches both logos in place and opens direct product links without an overlay", async ({
  page,
}) => {
  await page.goto("/#/listing/shop/studio-headphones");
  await expect(
    page.getByRole("heading", { name: "Studio Wireless Headphones", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  for (const logo of await page
    .getByRole("link", { name: "LOCAIZ home" })
    .all()) {
    await expect(logo.locator(".brand-symbol rect")).toHaveCSS(
      "fill",
      "rgb(255, 246, 236)",
    );
    await expect(logo.locator(".wordmark path")).toHaveCSS(
      "fill",
      "rgb(255, 246, 236)",
    );
  }
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#startup-loader")).toHaveCount(0);
});

test("recovers from invalid stored theme and from a failed route chunk", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("locaiz-demo-v1", "{bad json"),
  );
  const chunk = /\/assets\/marketplace-[^/]+\.js$/;
  await page.route(chunk, (route) => route.abort());
  await page.goto("/#/shop");
  await expect(
    page.getByRole("heading", { name: "Unable to load LOCAIZ" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#startup-loader")).toHaveCount(0);
  await page.unroute(chunk);
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Shop", level: 1 }),
  ).toBeVisible();
});

test("storage denial uses safe defaults and leaves the theme toggle usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Denied", "SecurityError");
      },
    });
  });
  await page.goto("/#/about");
  await expect(
    page.getByRole("heading", { name: "Commerce begins everywhere." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("a failed entry script reaches the themed reload screen", async ({
  page,
}) => {
  const entry = /\/assets\/index-[^/]+\.js$/;
  await page.route(entry, (route) => route.abort());
  await page.goto("/#/contact");
  await expect(
    page.getByRole("button", { name: "Reload LOCAIZ" }),
  ).toBeVisible();
  await page.unroute(entry);
  await page.getByRole("button", { name: "Reload LOCAIZ" }).click();
  await expect(
    page.getByRole("heading", { name: "Every connection starts somewhere.", level: 1 }),
  ).toBeVisible();
  await expect(page.locator("#startup-loader")).toHaveCount(0);
});
