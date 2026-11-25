import { expect, test } from "@playwright/test";

test("product delivery disclosures keep dispatch, transit, and pickup separate", async ({
  page,
}) => {
  await page.goto("/#/listing/shop/studio-headphones");
  const panel = page.getByRole("region", { name: "Delivery and pickup" });
  await expect(
    panel.getByText("Production lead time", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Dispatch estimate", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Transit estimate", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Awaiting confirmed dispatch and transit terms"),
  ).toBeVisible();
  await expect(panel.getByText(/Shipping quote pending/)).toBeVisible();
});
