import { expect, test } from "@playwright/test";

test("regional craft images lead to maker profiles and demo sourcing requests", async ({ page }) => {
  test.skip(process.env.VITE_MARKETPLACE_FOUNDATION === "1", "Demo build");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const region = page.getByRole("region", { name: "Handmade & art by state" });
  await expect(region.getByRole("img")).toHaveCount(2);
  await expect(region.locator("li img")).toHaveCount(16);
  const mural = region.getByRole("link", { name: "Kerala mural art" });
  await mural.scrollIntoViewIfNeeded();
  await expect.poll(() => mural.locator("img").evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(320);
  await mural.click();
  await expect(page.getByRole("heading", { name: "Regional Maker Discovery" })).toBeVisible();
  await page.getByLabel("Maker location").selectOption("Thrissur");
  await expect(page.getByRole("heading", { name: "Kerala Mural Workshop" })).toBeVisible();
  await page.getByRole("link", { name: "View maker profile for Kerala Mural Workshop" }).click();
  await expect(page.getByRole("heading", { name: "Kerala Mural Workshop" })).toBeVisible();
  await page.getByRole("link", { name: "Start a sourcing request" }).click();
  await expect(page.getByLabel("Requirement", { exact: true })).toHaveValue("Kerala mural art");
  await expect(page.getByLabel("Specifications")).toHaveValue(/Preferred sample maker: Kerala Mural Workshop/);
});

test("a craft without samples can still start a sourcing request", async ({ page }) => {
  test.skip(process.env.VITE_MARKETPLACE_FOUNDATION === "1", "Demo build");
  await page.goto("/#/sourcing/regional?region=kerala&craft=Kasavu+handloom");
  await expect(page.getByText("No makers listed for this craft and location yet.")).toBeVisible();
  await page.getByRole("link", { name: "Start a sourcing request" }).click();
  await expect(page.getByLabel("Requirement", { exact: true })).toHaveValue("Kasavu handloom");
});

test("@journey a buyer resumes a craft brief and receives separate sample quote terms", async ({ page, browser, baseURL }) => {
  const password = process.env.LOCAIZ_PILOT_PASSWORD;
  test.skip(!password || process.env.VITE_MARKETPLACE_FOUNDATION !== "1", "Requires disposable Supabase");
  test.setTimeout(120000);
  await page.goto("/#/sourcing/regional?region=tamil-nadu&craft=Tanjore+painting");
  await page.getByLabel("Maker location").selectOption("regional-browser-thanjavur");
  const maker = page.getByRole("article").filter({ hasText: "Regional Browser Maker" });
  await expect(maker).toContainText("Minimum order 3");
  await expect(maker).toContainText("Custom orders accepted");
  await expect(maker).not.toContainText("Pickup offered");
  await maker.getByRole("link", { name: "View maker profile for Regional Browser Maker" }).click();
  await expect(page.getByRole("heading", { name: "Regional Browser Maker" })).toBeVisible();
  await page.getByRole("link", { name: "Request a quote" }).click();
  await page.getByLabel("Email", { exact: true }).fill("buyer-a@stock.example.com");
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.locator("main form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Requirement title")).toHaveValue("Tanjore painting");
  await expect(page.getByLabel("Regional Browser Maker")).toBeChecked();
  await page.getByLabel("Painting dimensions").fill("30 x 40 cm");
  await page.getByLabel("Frame", { exact: true }).fill("Teak frame");
  await page.getByLabel("Finish", { exact: true }).fill("Matte");
  await page.getByLabel("Sample quantity").fill("2");
  await page.getByLabel("Planned bulk quantity").fill("50");
  await page.getByLabel("Destination", { exact: true }).fill("Chennai");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved on this browser.")).toBeVisible();
  await page.getByRole("link", { name: "My Buying Journey" }).click();
  await page.getByRole("region", { name: "RFQ drafts" }).getByRole("link", { name: "Resume" }).click();
  await expect(page.getByLabel("Sample quantity")).toHaveValue("2");
  await expect(page.getByLabel("Painting dimensions")).toHaveValue("30 x 40 cm");
  await page.getByRole("button", { name: "Review RFQ" }).click();
  const review = page.getByRole("region", { name: "Craft RFQ review" });
  await expect(review).toContainText("Makers: Regional Browser Maker");
  await expect(review).toContainText("Planned bulk quantity: 50 units");
  await expect(review).toContainText("Sample quantity: 2");
  await expect(review).toContainText("Delivery: Chennai");
  await page.getByRole("button", { name: "Send RFQ" }).click();
  await page.getByRole("link", { name: /Tanjore painting/ }).click();
  const threadId = new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("thread");
  expect(threadId).toBeTruthy();

  const seller = await browser.newPage({ baseURL });
  try {
    await seller.goto("/#/business/journey?thread=" + threadId);
    await seller.getByLabel("Email", { exact: true }).fill("seller-b@stock.example.com");
    await seller.getByLabel("Password", { exact: true }).fill(password!);
    await seller.locator("main form").getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(seller.getByText(/Painting dimensions: 30 x 40 cm/)).toBeVisible();
    await seller.getByRole("button", { name: "Accept invitation" }).click();
    await seller.getByText("Prepare quote", { exact: true }).click();
    await seller.getByLabel("Unit price (minor units)").fill("20000");
    await seller.getByLabel("Minimum order quantity").fill("3");
    await seller.getByLabel("Production days").fill("12");
    await seller.getByLabel("Expires").fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await seller.getByLabel("Sample cost (minor units)").fill("10000");
    await seller.getByLabel("Sample lead time (days)").fill("5");
    await seller.getByLabel("Sample delivery option").selectOption("Pickup");
    await seller.getByRole("button", { name: "Send quote", exact: true }).click();
    await expect(seller.getByRole("region", { name: "Sample quote" })).toContainText("Lead time 5 days");
    await seller.getByText("Revise quote", { exact: true }).click();
    await expect(seller.getByLabel("Sample cost (minor units)")).toHaveValue("10000");
    await expect(seller.getByLabel("Sample delivery option")).toHaveValue("Pickup");
    await page.reload();
    await expect(page.getByRole("region", { name: "Sample quote" })).toContainText("Separate from the bulk order total.");
  } finally {
    await seller.close();
  }
});

test("a basket brief reviews sample, bulk and custom details separately in Demo Mode", async ({ page }) => {
  test.skip(process.env.VITE_MARKETPLACE_FOUNDATION === "1", "Demo build");
  await page.goto("/#/sourcing/regional?region=tamil-nadu&craft=Chettinad+baskets");
  await page.getByRole("link", { name: "Start a sourcing request" }).click();
  await page.getByLabel("Basket size").fill("30 cm wide");
  await page.getByLabel("Weave", { exact: true }).fill("Tight weave");
  await page.getByLabel("Handle style").fill("Two loop handles");
  await page.getByLabel("Colour", { exact: true }).fill("Natural");
  await page.getByLabel("Sample quantity").fill("1");
  await page.getByLabel("Planned bulk quantity").fill("50");
  await page.getByRole("button", { name: "Review requirement" }).click();
  const review = page.getByRole("region", { name: "Requirement review" });
  await expect(review).toContainText("50 units");
  await expect(review).toContainText("Sample quantity: 1");
  await expect(review).toContainText("Handle style: Two loop handles");
  await page.getByRole("button", { name: "Save demo requirement" }).click();
  await expect(page.getByRole("heading", { name: "Chettinad baskets", exact: true })).toBeVisible();
});
