import { expect, test, type Page } from "@playwright/test";

const password = process.env.LOCAIZ_PILOT_PASSWORD;
const enabled = Boolean(
  password && process.env.VITE_MARKETPLACE_FOUNDATION === "1",
);
async function signIn(page: Page, label: string) {
  await page
    .getByLabel("Email", { exact: true })
    .fill(label + "@stock.example.com");
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page
    .locator("main form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conversations" }),
  ).toBeVisible();
}

test("@journey a buyer and supplier exchange private files, revise a quote, and create an order explicitly", async ({
  browser,
  baseURL,
}) => {
  test.skip(!enabled, "Requires disposable Supabase");
  test.setTimeout(120000);
  const buyer = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  const seller = await browser.newContext({ baseURL });
  const other = await browser.newContext({ baseURL });
  try {
    const [b, s, o] = await Promise.all([
      buyer.newPage(),
      seller.newPage(),
      other.newPage(),
    ]);
    await b.goto("/#/account/journey?new=1");
    await signIn(b, "buyer-b");
    await b.getByLabel("Requirement title").fill("Browser QA quotation");
    await b
      .getByLabel("Specifications")
      .fill("Specification for a small ceramic collection");
    await b.getByLabel("Quantity", { exact: true }).fill("12");
    await b.getByLabel("Destination", { exact: true }).fill("Chennai");
    await b.getByLabel("Journey Browser Supplier").check();
    await b.getByLabel("Private requirement attachment").setInputFiles({
      name: "spec.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await b.getByRole("button", { name: "Send RFQ" }).click();
    await expect(
      b.getByRole("heading", { name: "Browser QA quotation" }),
    ).toBeVisible();
    await b.getByRole("link", { name: /Browser QA quotation/ }).click();

    const thread = new URLSearchParams(new URL(b.url()).hash.split("?")[1]).get("thread");
    const sellerThread = "/business/journey?thread=" + thread;
    await s.goto("/#" + sellerThread);
    await signIn(s, "seller-b");
    await expect(s.getByRole("link", { name: "RFQ received", exact: true })
      .and(s.locator('a[href="#' + sellerThread + '"]'))).toBeVisible();
    await s.getByRole("button", { name: "Accept invitation" }).click();
    await s.getByRole("button", { name: "Get private attachment" }).click();
    await expect(
      s.getByRole("link", { name: "Open attachment" }),
    ).toHaveAttribute("href", /\/storage\/v1\/object\/sign\/journey-private\//);
    await s
      .getByLabel("Message", { exact: true })
      .fill("We can manufacture your ceramic collection.");
    await s.getByRole("button", { name: "Send message" }).click();
    await expect(s.getByText("Message sent.")).toBeVisible();
    await b.reload();
    await expect(
      b.getByText("We can manufacture your ceramic collection."),
    ).toBeVisible();
    await o.goto(
      new URL(b.url()).hash
        .replace("/account/journey", "/business/journey")
        .replace("#", "/#"),
    );
    await signIn(o, "seller-c");
    await expect(o.getByText("Conversation unavailable.")).toBeVisible();

    await s.getByText("Prepare quote", { exact: true }).click();
    await s.getByLabel("Currency code").fill("USD");
    await s.getByLabel("Unit price (minor units)").fill("800");
    await s.getByLabel("Minimum order quantity").fill("10");
    await s.getByLabel("Shipping (minor units)").fill("2000");
    await s.getByLabel("Tax (minor units)").fill("500");
    await s.getByLabel("Duties (minor units)").fill("0");
    await s.getByLabel("Other fees (minor units)").fill("0");
    await s.getByLabel("Production days").fill("5");
    await s.getByLabel("Transit days").fill("3");
    await s
      .getByLabel("Expires")
      .fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
    await s.getByLabel("Can fulfill at the requested destination").check();
    await s.getByRole("button", { name: "Send quote", exact: true }).click();
    await expect(s.getByText(/Revision 1 ·/)).toBeVisible();
    await s.getByText("Revise quote", { exact: true }).click();
    await s.getByLabel("Unit price (minor units)").fill("700");
    await s.getByRole("button", { name: "Send revision" }).click();
    await expect(s.getByText(/Revision 2 ·/)).toBeVisible();

    await b.reload();
    await expect(b.getByText(/Revision 2 ·/)).toBeVisible();
    await b.getByText("Compare supplier quotes", { exact: true }).click();
    const comparison = b.getByRole("region", {
      name: "Supplier quote comparison",
    });
    await expect(
      comparison.getByRole("cell", { name: "USD", exact: true }),
    ).toBeVisible();
    await expect(
      comparison.getByRole("cell", { name: "$109.00", exact: true }),
    ).toBeVisible();
    expect(
      await b.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await b.getByRole("button", { name: "Select quote", exact: true }).click();
    await expect(b.getByText(/Quote selected/)).toBeVisible();
    await expect(b.getByRole("heading", { name: /^Order / })).toHaveCount(0);
    await s.reload();
    await s.getByRole("button", { name: "Confirm quoted terms" }).click();
    await b.reload();
    await b.getByText("Review and create order", { exact: true }).click();
    await b.getByRole("button", { name: "Confirm and create order" }).click();
    await expect(b.getByText(/Payment status unrecorded/)).toBeVisible();
    await b.getByRole("link", { name: "My Buying Journey" }).click();
    await b.getByLabel("Activity type").selectOption("Orders");
    const orderEvent = b.getByRole("link", { name: "Order confirmed", exact: true });
    await expect(orderEvent).toHaveCount(1);
    await orderEvent.click();
    await expect(b.getByText(/Payment status unrecorded/)).toBeVisible();
    await s.reload();
    await s.getByRole("button", { name: "Mark preparing" }).click();
    await expect(s.getByText(/preparing · shipping/)).toBeVisible();
  } finally {
    await Promise.all([buyer.close(), seller.close(), other.close()]);
  }
});

test("public buyer workspace offers Demo Mode when disconnected", async ({
  page,
}) => {
  test.skip(enabled, "Connected test build");
  await page.goto("/#/account/journey");
  await expect(page.getByRole("link", { name: "Demo Mode" })).toHaveAttribute(
    "href",
    "#/shop",
  );
});

test("@journey a stock reservation is requested and separately approved", async ({
  browser,
  baseURL,
}) => {
  test.skip(!enabled, "Requires disposable Supabase");
  const buyer = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  const seller = await browser.newContext({ baseURL });
  try {
    const b = await buyer.newPage();
    const s = await seller.newPage();
    async function stockLogin(page: Page, account: string, path: string) {
      await page.goto("/#" + path);
      await page
        .getByLabel("Email", { exact: true })
        .fill(account + "@stock.example.com");
      await page.getByLabel("Password", { exact: true }).fill(password!);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(
        page.getByText("Signed in as " + account + "@stock.example.com"),
      ).toBeVisible();
    }
    const request = "50000000-0000-4000-8000-000000000010";
    await stockLogin(b, "buyer-b", "/account/stock-new");
    await b.goto("/#/account/stock?request=" + request);
    await b.getByRole("button", { name: "Request reservation" }).click();
    await expect(b.getByText(/1 units · requested/)).toBeVisible();
    await stockLogin(s, "seller-a", "/business/stock?request=" + request);
    await s
      .getByText("Inventory and pickup reservations", { exact: true })
      .click();
    await s
      .getByLabel("Pickup instructions")
      .fill("Ask for the gift packaging at the counter.");
    await s.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(s.getByText(/1 units · approved/)).toBeVisible();
    await b.reload();
    await expect(b.getByText(/1 units · approved/)).toBeVisible();
    await expect(b.getByText(/Ask for the gift packaging/)).toBeVisible();
    await b.goto("/#/account/stock-notifications");
    await expect(
      b.getByRole("link", { name: "Pickup reservation approved" }),
    ).toHaveCount(1);
  } finally {
    await Promise.all([buyer.close(), seller.close()]);
  }
});
