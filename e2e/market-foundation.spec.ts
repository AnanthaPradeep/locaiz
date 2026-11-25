import { expect, test, type Page } from "@playwright/test";
const password = process.env.LOCAIZ_PILOT_PASSWORD;
const mail = process.env.LOCAIZ_MAILPIT_URL;
const enabled = !!password && process.env.VITE_MARKETPLACE_FOUNDATION === "1";

async function login(page: Page, label: string) {
  await page.goto("/#/account/sign-in");
  const form = page.locator("main form");
  await form.getByLabel("Email").fill(label + "@stock.example.com");
  await form.getByLabel("Password").fill(password!);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

test("public Pages-style build keeps connected routes in Demo Mode", async ({
  page,
}) => {
  test.skip(enabled, "Connected test build");
  await page.goto("/#/business/studio");
  await expect(
    page.getByText("Connected Marketplace is unavailable.", { exact: false }),
  ).toBeVisible();
});

test("@market seller draft, stock, approval, public catalogue and admin isolation", async ({
  browser,
  baseURL,
}) => {
  test.skip(!enabled, "Requires disposable Supabase");
  test.setTimeout(150000);
  const seller = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  const operator = await browser.newContext({ baseURL });
  const buyer = await browser.newContext({ baseURL });
  try {
    const s = await seller.newPage(),
      o = await operator.newPage(),
      b = await buyer.newPage();
    await login(s, "seller-a");
    await s.getByLabel("Display name").fill("Demo maker QA");
    await s.getByRole("button", { name: "Save profile" }).click();
    await expect(s.getByText("Profile saved.")).toBeVisible();
    await s.getByRole("link", { name: "Seller Studio" }).click();
    await s.getByLabel("Business name").fill("Foundation Studio QA");
    await s.getByLabel("Business type").selectOption("Artisan");
    await s.getByLabel("Locality", { exact: true }).fill("Nagercoil");
    await s
      .getByRole("button", { name: "Create business", exact: true })
      .click();
    await expect(
      s.getByRole("heading", { name: "Foundation Studio QA" }),
    ).toBeVisible();
    await s.getByRole("button", { name: "Business settings" }).click();
    await s
      .getByLabel("Verification summary")
      .fill("Local pilot business review.");
    await s.getByRole("button", { name: "Submit verification" }).click();
    await expect(s.getByText("Pending Review", { exact: true })).toBeVisible();
    await s.getByRole("button", { name: "New product" }).click();
    const editor = s.locator(".market-editor");
    await editor.getByLabel("Product name").fill("QA Runtime Lamp");
    await editor.getByLabel("Category").selectOption("market-handmade");
    await editor.getByLabel("SKU").fill("RUNTIME-LAMP");
    await editor.getByLabel("Unit price in minor units").fill("125000");
    await editor.getByLabel("Inventory quantity").fill("10");
    await editor
      .getByLabel("Product images")
      .setInputFiles({
        name: "bad.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg/>"),
      });
    await editor.getByRole("button", { name: "Save draft" }).click();
    await expect(editor.getByRole("alert")).toContainText("Choose a JPEG");
    await editor.getByLabel("Product images").setInputFiles({
      name: "lamp.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await editor.getByRole("button", { name: "Save draft" }).click();
    await expect(editor.getByText("Draft saved.")).toBeVisible();
    const draft = s.locator("article").filter({ hasText: "QA Runtime Lamp" });
    await expect(draft.getByText(/1 images/)).toBeVisible();
    await draft.getByLabel("RUNTIME-LAMP inventory").fill("4");
    await draft.getByRole("button", { name: "Update inventory" }).click();
    await expect(s.getByText("Inventory updated.")).toBeVisible();
    await draft.getByRole("button", { name: "Submit for publication" }).click();
    await expect(s.getByText("Listing submitted.")).toBeVisible();
    await b.goto("/#/search?q=QA+Runtime+Lamp");
    const connected = b.getByRole("region", {
      name: "Published marketplace listings",
    });
    await expect(connected.getByText("0 published offers")).toBeVisible();
    await login(o, "seller-c");
    await o.getByRole("link", { name: "Trust Center" }).click();
    const verification = o
      .locator("article")
      .filter({ hasText: "Supplier: Foundation Studio QA" });
    await verification
      .getByRole("button", { name: "Approve verification" })
      .click();
    await expect(
      verification.getByRole("button", { name: "Restrict supplier" }),
    ).toBeVisible();
    const listing = o
      .locator("article")
      .filter({ hasText: "Listing: QA Runtime Lamp" });
    await listing.getByRole("button", { name: "Start review" }).click();
    await expect(
      listing.getByRole("button", { name: "Start review" }),
    ).toHaveCount(0);
    await listing.getByRole("button", { name: "Approve publication" }).click();
    await expect(listing).toHaveCount(0);
    await b.reload();
    await connected.getByRole("link", { name: "QA Runtime Lamp" }).click();
    await expect(
      b.getByRole("heading", { name: "QA Runtime Lamp", level: 1 }),
    ).toBeVisible();
    await b.getByRole("link", { name: "Supplier Trust Passport" }).click();
    await expect(
      b.getByRole("heading", { name: "Verified", exact: true }),
    ).toBeVisible();
    await login(b, "buyer-a");
    await b.getByRole("link", { name: "Trust Center" }).click();
    await expect(b.getByText("Operator access is required.")).toBeVisible();
    await s.reload();
    await expect(draft.getByText(/published/)).toBeVisible();
    await expect(draft.getByLabel("RUNTIME-LAMP inventory")).toHaveValue("4");
    expect(
      await s.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  } finally {
    await Promise.all([seller.close(), operator.close(), buyer.close()]);
  }
});

test("@market email verification and password recovery through disposable mail", async ({
  page,
  request,
}) => {
  test.skip(!enabled || !mail, "Requires local authentication and Mailpit");
  test.setTimeout(90000);
  const email = "phase1-" + Date.now() + "@market.example.com";
  async function mailLink(type: string) {
    let id = "";
    await expect
      .poll(
        async () => {
          const response = await request.get(mail! + "/api/v1/search", {
            params: { query: "to:" + email },
          });
          if (!response.ok()) return "";
          const data = (await response.json()) as {
            messages: { ID: string; Subject: string }[];
          };
          id =
            data.messages?.find((message) =>
              message.Subject.toLowerCase().includes(type),
            )?.ID ?? "";
          return id;
        },
        { timeout: 25000 },
      )
      .not.toBe("");
    const response = await request.get(mail! + "/api/v1/message/" + id);
    const { HTML } = (await response.json()) as { HTML: string };
    const link = HTML.match(
      /href=["']([^"']*\/auth\/v1\/verify[^"']+)/i,
    )?.[1]?.replaceAll("&amp;", "&");
    if (!link || !["127.0.0.1", "localhost"].includes(new URL(link).hostname))
      throw new Error("Expected local email verification URL");
    return link;
  }
  await page.goto("/#/account/sign-in");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Send verification email" }).click();
  await expect(
    page.getByText("Check your inbox to verify your email address."),
  ).toBeVisible();
  await page.goto(await mailLink("confirm"));
  await expect(page.getByText(/Email verified/)).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Reset password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send recovery email" }).click();
  await expect(
    page.getByText(/check your inbox for the recovery link/),
  ).toBeVisible();
  await page.goto(await mailLink("reset"));
  await page.getByLabel("New password").fill(password! + "new");
  await page.getByRole("button", { name: "Update password" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password! + "new");
  await page
    .locator("main form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
