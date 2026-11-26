import { expect, test } from "@playwright/test";

test("regional craft imagery and demo sourcing links work on mobile", async ({ page }) => {
  test.skip(process.env.VITE_MARKETPLACE_FOUNDATION === "1", "Demo build");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const region = page.getByRole("region", { name: "Handmade & art by state" });
  await expect(region.getByRole("img")).toHaveCount(2);
  for (const image of await region.getByRole("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(720);
  }
  await expect(region.getByRole("heading", { name: "Tamil Nadu" })).toBeVisible();
  await expect(region.getByRole("heading", { name: "Kerala" })).toBeVisible();
  await expect(region.locator("li img")).toHaveCount(16);
  const mural = region.getByRole("link", { name: "Kerala mural art" });
  await mural.scrollIntoViewIfNeeded();
  await expect.poll(() => mural.locator("img").evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(320);
  await mural.click();
  await expect(page.getByLabel("Requirement", { exact: true })).toHaveValue("Kerala mural art");
});
