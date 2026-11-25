import { expect, test } from "@playwright/test";

test("@journey completed order copies quantities when the current tier price changes", async ({
  page,
}) => {
  const password = process.env.LOCAIZ_PILOT_PASSWORD;
  test.skip(
    !password || process.env.VITE_MARKETPLACE_FOUNDATION !== "1",
    "Requires disposable Supabase",
  );
  await page.goto(
    "/#/account/bulk-buying?order=33000000-0000-4000-8000-000000000005",
  );
  const form = page.locator("main form");
  await form.getByLabel("Email").fill("buyer-a@stock.example.com");
  await form.getByLabel("Password").fill(password!);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/Original unit price.*650/)).toBeVisible();
  await page
    .getByRole("button", { name: "Add SKU to quotation basket" })
    .click();
  await expect(
    page.getByLabel("Quantity for Browser Bulk Stoneware"),
  ).toHaveValue("5");
  await expect(page.getByText(/800.*listed per unit/)).toBeVisible();
  await page.getByLabel("Delivery destination").fill("Chennai");
  await page.getByRole("button", { name: "Send supplier RFQs" }).click();
  await page.getByRole("link", { name: "Browser Bulk Stoneware RFQ" }).click();
  await expect(
    page.getByRole("heading", { name: "Browser Bulk Stoneware" }),
  ).toBeVisible();
});
