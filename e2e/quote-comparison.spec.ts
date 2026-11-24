import { expect, test } from "@playwright/test";

test("compares quantity, incomplete totals and timing, then saves a local decision", async ({
  page,
}) => {
  await page.goto("/#/account/requirements");
  await page.getByRole("link", { name: "Try demo quote comparison" }).click();
  await expect(
    page.getByRole("heading", { name: "50 handmade baskets" }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Compare Palm Weave Collective" })
    .check();
  await page
    .getByRole("checkbox", { name: "Compare Reed & Cane Workshop" })
    .check();
  await page
    .getByRole("checkbox", { name: "Compare Delta Craft Co-op" })
    .check();
  await expect(
    page.getByRole("checkbox", { name: "Compare Export Basket Studio" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Compare quotes" }).click();
  const table = page.getByRole("table");
  await expect(
    table.getByText("Does not meet requested quantity"),
  ).toBeVisible();
  await expect(
    table
      .getByRole("row", { name: /^Shipping/ })
      .getByText("Awaiting quotation"),
  ).toBeVisible();
  await expect(
    table
      .getByRole("row", { name: /^Deadline suitability/ })
      .getByText("Likely late"),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await table.getByRole("button", { name: "Shortlist" }).nth(1).click();
  await table
    .getByRole("button", { name: "Request clarification" })
    .nth(1)
    .click();
  await table.getByRole("button", { name: "Save local draft" }).click();
  await table.getByRole("button", { name: "Select quote" }).nth(1).click();
  await table.getByRole("button", { name: "Confirm quote choice" }).click();
  await page.reload();
  await expect(
    page.getByText("Selected quote: Reed & Cane Workshop", { exact: false }),
  ).toBeVisible();
  await expect(
    table.getByRole("button", { name: "Shortlist" }).nth(1),
  ).toHaveAttribute("aria-pressed", "true");
});
