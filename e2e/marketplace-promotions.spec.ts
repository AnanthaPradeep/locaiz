import { expect, test } from "@playwright/test";

const discovery = [
  ["/nearby", "Discover Shops Near You"],
  ["/sourcing", "Explore Regional Makers"],
  ["/care", "Repairs Made Easier"],
  ["/connect", "Need Something Made to Order?"],
  ["/business", "Start Selling on LOCAIZ"],
] as const;

for (const width of [360, 390, 768, 1024, 1440, 1920]) {
  test(`marketplace campaigns and responsive images fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (width === 390 || width === 1440) {
      await page.addInitScript(() => localStorage.setItem("locaiz-demo-v1", JSON.stringify({ state: { theme: "dark" }, version: 0 })));
    }
    for (const [path, title] of discovery) {
      await page.goto("/#" + path);
      const campaign = page.getByRole("region", { name: "Marketplace promotions" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", width === 390 || width === 1440 ? "dark" : "light");
      await expect(campaign.getByRole("heading", { level: 2, name: title })).toBeVisible();
      for (const image of await campaign.locator("img").all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((node) => (node as HTMLImageElement).decode());
      }
      const banner = campaign.locator(".home-campaign--featured img");
      const src = await banner.evaluate((node) => (node as HTMLImageElement).currentSrc);
      expect(src).toMatch(width <= 650 ? /-mobile\.webp$/ : /-desktop\.webp$/);
      await expect(campaign.getByText("Sponsored", { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test("Nearby and Care campaigns focus results and illustrate matching demo listings", async ({ page }) => {
  await page.goto("/#/nearby?distance=3");
  const nearby = page.getByRole("button", { name: "Explore Nearby Shops" });
  await nearby.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Nearby shop results" })).toBeFocused();
  await expect(page).toHaveURL(/distance=3/);
  await expect(page.locator(".listing-card img[src$='nearby-local-store.webp']")).toHaveCount(1);
  await page.getByRole("button", { name: "Map view" }).click();
  await expect(page.getByRole("button", { name: "List view" })).toBeVisible();

  await page.goto("/#/care");
  await page.getByRole("button", { name: "Explore Repair Services" }).click();
  await expect(page.getByRole("region", { name: "Care service results" })).toBeFocused();
  await expect(page.locator(".listing-card .card-illustrative")).toHaveCount(6);
  const sources = await page.locator(".listing-card img").evaluateAll((nodes) => nodes.map((node) => (node as HTMLImageElement).src));
  expect(new Set(sources).size).toBe(6);
  await page.getByRole("link", { name: "Appliance Repair", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Appliance Repair", exact: true })).toBeVisible();
});

test("Atlas promotion links use regional and existing industrial filters", async ({ page }) => {
  await page.goto("/#/sourcing");
  await expect(page.getByRole("region", { name: "Sourcing promotion" })).toHaveCount(1);
  await page.getByRole("link", { name: "Explore Tamil Nadu Crafts" }).click();
  await expect(page).toHaveURL(/region=tamil-nadu/);
  await page.goBack();
  await page.getByRole("link", { name: "Explore Kerala Crafts" }).click();
  await expect(page).toHaveURL(/region=kerala/);
  await page.goBack();
  await page.getByRole("link", { name: "Explore Industrial Suppliers" }).click();
  await expect(page).toHaveURL(/category=Wholesale\+and\+industrial/);
  await page.locator(".sourcing-more summary").click();
  await page.getByLabel("Maximum MOQ").fill("20");
  await expect(page).toHaveURL(/maxMoq=20/);
});

test("Connect keeps unsaved requirement input when a promotion is cancelled", async ({ page }) => {
  test.skip(process.env.VITE_MARKETPLACE_FOUNDATION === "1", "Demo CTA");
  await page.goto("/#/connect?product=Craft+sample");
  await page.getByRole("button", { name: "Start a Sourcing Request" }).click();
  await expect(page.getByRole("region", { name: "Sourcing request form" })).toBeFocused();
  const field = page.getByLabel("Requirement", { exact: true });
  await expect(field).toHaveValue("Craft sample");
  await field.fill("Unsent craft brief");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Find Manufacturers" }).click();
  await expect(field).toHaveValue("Unsent craft brief");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "Find Manufacturers" }).click();
  await expect(page).toHaveURL(/role=Small\+manufacturer/);
});

test("Business promotes seller onboarding on its entry route", async ({ page }) => {
  test.skip(process.env.VITE_MARKETPLACE_FOUNDATION === "1", "Demo CTA");
  await page.goto("/#/business");
  await page.getByRole("region", { name: "Marketplace promotions" }).getByRole("link", { name: "Become a Seller" }).click();
  await expect(page).toHaveURL(/#\/sourcing\/onboarding/);
  await expect(page.getByRole("region", { name: "Marketplace promotions" })).toHaveCount(0);
  await page.goto("/#/business/inventory");
  await expect(page.getByRole("region", { name: "Marketplace promotions" })).toHaveCount(0);
});

test("@market connected promotions keep routing to existing appointments, RFQs and Seller Studio", async ({ page }) => {
  test.skip(process.env.VITE_MARKETPLACE_FOUNDATION !== "1", "Connected build");
  await page.goto("/#/care");
  await page.getByRole("link", { name: "Live service appointments" }).click();
  await expect(page).toHaveURL(/#\/care\/live/);
  await expect(page.getByRole("region", { name: "Marketplace promotions" })).toHaveCount(0);

  await page.goto("/#/connect");
  await page.getByRole("region", { name: "Marketplace promotions" }).getByRole("link", { name: "Start a Sourcing Request" }).click();
  await expect(page).toHaveURL(/#\/account\/journey\?new=1/);

  await page.goto("/#/business");
  await page.getByRole("region", { name: "Marketplace promotions" }).getByRole("link", { name: "Become a Seller" }).click();
  await expect(page).toHaveURL(/#\/business\/studio/);
  await expect(page.getByRole("region", { name: "Marketplace promotions" })).toHaveCount(0);
});
