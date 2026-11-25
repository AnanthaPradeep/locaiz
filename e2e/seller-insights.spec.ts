import { expect, test, type Page } from "@playwright/test";

test("@journey seller insights uses deduplicated real views and business permissions", async ({
  browser,
  baseURL,
}) => {
  const password = process.env.LOCAIZ_PILOT_PASSWORD;
  test.skip(
    !password || process.env.VITE_MARKETPLACE_FOUNDATION !== "1",
    "Requires disposable Supabase",
  );
  const buyer = await browser.newContext({ baseURL });
  const seller = await browser.newContext({ baseURL });
  async function login(page: Page, user: string) {
    await page.goto("/#/business/insights");
    const form = page.locator("main form");
    await form.getByLabel("Email").fill(user + "@stock.example.com");
    await form.getByLabel("Password").fill(password!);
    await form.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  try {
    const b = await buyer.newPage();
    const s = await seller.newPage();
    await login(b, "buyer-b");
    await expect(
      b.getByText("Seller management permissions are required."),
    ).toBeVisible();
    const recorded = b.waitForResponse((response) =>
      response.url().includes("/rpc/record_product_view"),
    );
    await b.goto("/#/listing/shop/market-bulk-browser");
    expect((await recorded).ok()).toBe(true);
    await login(s, "seller-b");
    await s.getByLabel("Managed business").selectOption({label:"Journey Browser Supplier"});
    const viewCard = s
      .getByText("Signed-in catalogue views", { exact: true })
      .locator("..");
    await expect(viewCard.locator("dd")).toHaveText("1");
    await expect(
      s.getByText("Insufficient data", { exact: true }).first(),
    ).toBeVisible();
  } finally {
    await Promise.all([buyer.close(), seller.close()]);
  }
});
