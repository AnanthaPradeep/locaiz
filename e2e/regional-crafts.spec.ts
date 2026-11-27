import { expect, test } from "@playwright/test";

test("regional craft images lead to maker profiles and demo sourcing requests", async ({ page }) => {
  test.skip(process.env.VITE_MARKETPLACE_FOUNDATION === "1", "Demo build");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const region = page.getByRole("region", { name: "Handmade & art by state" });
  await expect(region.getByRole("img")).toHaveCount(2);
  await expect(region.locator("li img")).toHaveCount(16);
  const mural = region.getByRole("link", { name: "Kerala mural art" });
  await mural.scrollIntoViewIfNeeded();
  await expect.poll(() => mural.locator("img").evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(320);
  await mural.click();
  await expect(page.getByRole("heading", { name: "Regional Maker Discovery" })).toBeVisible();
  await page.getByLabel("Maker location").selectOption("Thrissur");
  await expect(page.getByRole("heading", { name: "Kerala Mural Workshop" })).toBeVisible();
  await page.getByRole("link", { name: "View maker profile for Kerala Mural Workshop" }).click();
  await expect(page.getByRole("heading", { name: "Kerala Mural Workshop" })).toBeVisible();
  await page.getByRole("link", { name: "Start a sourcing request" }).click();
  await expect(page.getByLabel("Requirement", { exact: true })).toHaveValue("Kerala mural art");
  await expect(page.getByLabel("Specifications")).toHaveValue(/Preferred sample maker: Kerala Mural Workshop/);
});

test("a craft without samples can still start a sourcing request", async ({ page }) => {
  test.skip(process.env.VITE_MARKETPLACE_FOUNDATION === "1", "Demo build");
  await page.goto("/#/sourcing/regional?region=kerala&craft=Kasavu+handloom");
  await expect(page.getByText("No makers listed for this craft and location yet.")).toBeVisible();
  await page.getByRole("link", { name: "Start a sourcing request" }).click();
  await expect(page.getByLabel("Requirement", { exact: true })).toHaveValue("Kasavu handloom");
});

test("@journey a published regional maker opens a craft and supplier prefilled RFQ", async ({ page }) => {
  const password = process.env.LOCAIZ_PILOT_PASSWORD;
  test.skip(!password || process.env.VITE_MARKETPLACE_FOUNDATION !== "1", "Requires disposable Supabase");
  await page.goto("/#/sourcing/regional?region=tamil-nadu&craft=Tanjore+painting");
  await page.getByLabel("Maker location").selectOption("regional-browser-thanjavur");
  const maker = page.getByRole("article").filter({ hasText: "Regional Browser Maker" });
  await expect(maker).toContainText("Minimum order 3");
  await expect(maker).toContainText("Custom orders accepted");
  await expect(maker).not.toContainText("Pickup offered");
  await maker.getByRole("link", { name: "View maker profile for Regional Browser Maker" }).click();
  await expect(page.getByRole("heading", { name: "Regional Browser Maker" })).toBeVisible();
  await page.getByRole("link", { name: "Request a quote" }).click();
  await page.getByLabel("Email", { exact: true }).fill("buyer-a@stock.example.com");
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.locator("main form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Requirement title")).toHaveValue("Tanjore painting");
  await expect(page.getByLabel("Regional Browser Maker")).toBeChecked();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
});
