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
    await b.getByRole("button", { name: "Save draft" }).click();
    await expect(b.getByText("Draft saved on this browser.")).toBeVisible();
    await b.reload();
    await b.getByRole("link", { name: "My Buying Journey" }).click();
    const draftList = b.getByRole("region", { name: "RFQ drafts" });
    await expect(draftList.getByRole("heading", { name: "Browser QA quotation" })).toBeVisible();
    await draftList.getByRole("link", { name: "Resume" }).click();
    await expect(b.getByLabel("Requirement title")).toHaveValue("Browser QA quotation");
    await expect(b.getByLabel("Quantity", { exact: true })).toHaveValue("12");
    await expect(b.getByLabel("Journey Browser Supplier")).toBeChecked();
    const sendRfq = b.getByRole("button", { name: "Send RFQ" });
    await b.getByLabel("Private requirement attachment").setInputFiles({
      name: "invalid.png",
      mimeType: "image/png",
      buffer: Buffer.from("Plain text QA fixture"),
    });
    await sendRfq.click();
    await expect(b.getByRole("alert")).toHaveText(
      "The file content does not match its selected format.",
    );
    await expect(b.getByLabel("Requirement title")).toHaveValue(
      "Browser QA quotation",
    );
    await b.getByRole("link", { name: "My Buying Journey" }).click();
    await draftList.getByRole("link", { name: "Resume" }).click();
    await b.getByLabel("Private requirement attachment").setInputFiles({
      name: "spec.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await sendRfq.click();
    await expect(
      b.getByRole("heading", { name: "Browser QA quotation" }),
    ).toBeVisible();
    await b.getByRole("link", { name: /Browser QA quotation/ }).click();

    const thread = new URLSearchParams(new URL(b.url()).hash.split("?")[1]).get(
      "thread",
    );
    const sellerThread = "/business/journey?thread=" + thread;
    await s.goto("/#" + sellerThread);
    await signIn(s, "seller-b");
    await expect(
      s
        .getByRole("link", { name: "RFQ received", exact: true })
        .and(s.locator('a[href="#' + sellerThread + '"]')),
    ).toBeVisible();
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
    await expect(
      o.getByRole("button", { name: "Get private attachment" }),
    ).toHaveCount(0);

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
    await b
      .getByRole("button", { name: "Shortlist quote", exact: true })
      .click();
    await expect(
      b.getByRole("button", { name: "Remove from shortlist" }),
    ).toBeVisible();
    await b.getByRole("link", { name: "My Buying Journey" }).click();
    await expect(draftList.getByRole("link", { name: "Resume" })).toHaveCount(0);
    await expect(
      b.getByRole("region", { name: "Shortlisted and selected quotes" }),
    ).toContainText("Shortlisted");
    const selection = b.getByRole("link", {
      name: "Quote selected",
      exact: true,
    });
    await expect(selection).toHaveCount(1);
    await selection.click();
    await s.reload();
    await s.getByRole("button", { name: "Confirm quoted terms" }).click();
    await b.reload();
    await b.getByText("Review and create order", { exact: true }).click();
    const createOrder = b.getByRole("button", { name: "Confirm and create order" });
    const orderRpc = "**/rest/v1/rpc/journey_action";
    let savedOrderId: string | undefined;
    await b.route(orderRpc, async (route) => {
      if (route.request().postDataJSON()?.command !== "create_order")
        return route.fallback();
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      savedOrderId = await response.json();
      // The database committed the order, but the browser never got the reply.
      await route.abort("connectionreset");
    });
    await createOrder.click();
    await expect(b.getByRole("alert")).not.toBeEmpty();
    expect(savedOrderId).toMatch(/^[0-9a-f-]{36}$/);
    await b.unroute(orderRpc);
    await createOrder.click();
    await expect(
      b.getByRole("heading", { name: "Order " + savedOrderId!.slice(0, 8), exact: true }),
    ).toBeVisible();
    await expect(b.getByRole("heading", { name: /^Order / })).toHaveCount(1);
    await expect(b.getByText(/Payment status unrecorded/)).toBeVisible();
    await b.getByRole("link", { name: "My Buying Journey" }).click();
    await b.getByLabel("Activity type").selectOption("Orders");
    const orderEvent = b.getByRole("link", {
      name: "Order confirmed",
      exact: true,
    });
    await expect(orderEvent).toHaveCount(1);
    await orderEvent.click();
    await expect(b.getByText(/Payment status unrecorded/)).toBeVisible();
    await s.reload();
    await s.getByRole("button", { name: "Mark preparing" }).click();
    await expect(s.getByText(/preparing · shipping/)).toBeVisible();
    const shipping = s.getByRole("region", { name: "Delivery and receipt" });
    await shipping.getByText("Enter shipping details").click();
    await shipping.getByLabel("Carrier").fill("QA Parcel Service");
    await shipping.getByLabel("Tracking number").fill("QA-ORDER-012");
    await shipping.getByLabel("Estimated delivery").fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    await shipping.getByRole("button", { name: "Confirm dispatch" }).click();
    await expect(s.getByText(/dispatched · shipping/)).toBeVisible();
    await expect(s.getByRole("button", { name: "Mark completed" })).toHaveCount(0);
    await b.reload();
    const receipt = b.getByRole("region", { name: "Delivery and receipt" });
    await expect(receipt).toContainText("QA-ORDER-012");
    await receipt.getByLabel("Received quantity").fill("12");
    await receipt.getByRole("button", { name: "Confirm receipt" }).click();
    await expect(b.getByText(/completed · shipping/)).toBeVisible();
    await b.getByRole("link", { name: "My Buying Journey" }).click();
    await b.getByLabel("Activity type").selectOption("Delivery");
    await expect(b.getByRole("link", { name: "Order dispatched", exact: true })).toBeVisible();
    await b.getByRole("link", { name: "Receipt confirmed", exact: true }).click();
    await b
      .getByText("Review this completed purchase", { exact: true })
      .click();
    await b
      .getByLabel("Review", { exact: true })
      .fill("Responsive and clear communication during production.");
    await b.getByRole("button", { name: "Submit review", exact: true }).click();
    await expect(b.getByText("Review sent for moderation.")).toBeVisible();
    await o.goto("/#/account/trust-center");
    const reviewQueue = o.getByRole("region", { name: "Review moderation" });
    const review = reviewQueue
      .locator("form")
      .filter({ hasText: "Responsive and clear communication" });
    await review
      .getByLabel("Moderation reason")
      .fill("Approved browser test review.");
    await review.getByRole("button", { name: "Publish review" }).click();
    await expect(
      reviewQueue.getByText("Moderation decision saved."),
    ).toBeVisible();
    await b.goto("/#/supplier/30000000-0000-4000-8000-000000000010");
    await expect(
      b
        .getByRole("region", { name: "Verified reviews" })
        .getByText("Responsive and clear communication during production."),
    ).toBeVisible();
    await b.goto("/#/account/journey?new=1");
    await b.getByLabel("Requirement title").fill("Private unfinished draft");
    await b.getByRole("button", { name: "Save draft" }).click();
    await expect(b.getByText("Draft saved on this browser.")).toBeVisible();
    await b.goto("/#/account/profile");
    await b.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(b.getByLabel("Password", { exact: true })).toBeVisible();
    await b.goto("/#/account/journey");
    await signIn(b, "buyer-a");
    await b.getByRole("link", { name: "My Buying Journey" }).click();
    await expect(draftList.getByText("No saved RFQ drafts on this browser.")).toBeVisible();
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
