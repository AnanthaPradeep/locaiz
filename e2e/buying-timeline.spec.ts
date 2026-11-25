import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1440]) {
  test("buying timeline is accessible at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/account/buying-journey");
    await expect(
      page.getByRole("heading", { name: "My Buying Journey" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Activity timeline" }),
    ).toBeVisible();
    await page.getByLabel("Activity type").selectOption("Orders");
    await expect(
      page.getByText("No activity in this view.", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("navigation", { name: "Buying activity" })
      .getByRole("link", { name: "Wishlist" })
      .click();
    await expect(page).toHaveURL(/account\/wishlist/);
  });
}
