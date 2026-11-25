import { expect, test } from "@playwright/test";

test("buyer can edit the local sourcing draft before comparing catalogue options", async ({
  page,
}) => {
  await page.goto("/#/connect");
  await page.getByRole("link", { name: "Build a sourcing brief" }).click();
  await page
    .getByLabel("Describe what you need")
    .fill(
      "I need 500 units of cotton bags, delivery to Chennai, budget INR 40,000",
    );
  await page.getByRole("button", { name: "Extract draft" }).click();
  await expect(page.getByLabel("Product description")).toHaveValue(
    "cotton bags",
  );
  await expect(page.getByLabel("Delivery destination")).toHaveValue("Chennai");
  await page.getByLabel("Quantity", { exact: true }).fill("600");
  await page
    .getByRole("link", { name: "Compare catalogue buying options" })
    .click();
  await expect(page).toHaveURL(/qty=600/);
});

test("@journey sourcing draft shows genuine published data and warns about MOQ", async ({
  page,
}) => {
  test.skip(
    process.env.VITE_MARKETPLACE_FOUNDATION !== "1" ||
      !process.env.LOCAIZ_PILOT_PASSWORD,
    "Requires disposable Supabase",
  );
  await page.goto("/#/sourcing-assistant");
  await page
    .getByLabel("Describe what you need")
    .fill("I need 1 unit of Browser Bulk Stoneware, delivery to Chennai");
  await page.getByRole("button", { name: "Extract draft" }).click();
  await page
    .getByRole("button", { name: "Search published suppliers" })
    .click();
  const offers = page.getByRole("region", {
    name: "Published supplier suggestions",
  });
  await expect(
    offers.getByRole("link", { name: "Journey Browser Supplier" }),
  ).toBeVisible();
  await expect(
    offers.getByText(/Requested quantity is below MOQ/),
  ).toBeVisible();
  await expect(offers.getByText(/INR/)).toBeVisible();
});
