import { expect, test } from "@playwright/test";

test("marketplace suggests a corrected product and zero results give a recovery link", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search marketplace" });
  await search.fill("wireles headphones");
  const suggestions = page.getByRole("list", {
    name: "Marketplace search suggestions",
  });
  await expect(
    suggestions.getByRole("link", { name: /Studio Wireless Headphones/ }),
  ).toBeVisible();
  await search.press("Escape");
  await expect(suggestions).toHaveCount(0);
  await page.goto("/#/shop?q=unmatchableword");
  const recovery = page.getByRole("region", { name: "Search recovery" });
  await expect(
    recovery.getByRole("link", { name: "Browse all products" }),
  ).toBeVisible();
  await recovery.getByRole("link", { name: "Browse all products" }).click();
  await expect(page.getByText(/Showing 1.12 of 50 products/)).toBeVisible();
});
