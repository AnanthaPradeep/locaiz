import { expect, test } from "@playwright/test";

test("search, wishlist, variant cart, checkout and persisted order", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Search marketplace" })
    .fill("studio wireless");
  await page.getByRole("button", { name: "Submit marketplace search" }).click();
  await expect(
    page.getByRole("heading", { name: /Results for/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add Studio Wireless Headphones to wishlist" })
    .click();
  await page
    .getByRole("link", { name: "Studio Wireless Headphones", exact: true })
    .first()
    .click();
  await page.getByLabel("Variant").selectOption("Gift packaging");
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page.getByText(/Gift packaging ·/)).toBeVisible();
  await page.getByRole("link", { name: "Continue to demo checkout" }).click();
  await page.getByRole("button", { name: "Place demo order" }).click();
  await expect(page.getByText("Demo retail order")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Demo retail order")).toBeVisible();
  await page.goto("/#/account/wishlist");
  await expect(
    page.getByRole("button", { name: "Remove Studio Wireless Headphones from wishlist" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("location, theme, group pricing and sample booking", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Your location/i }).click();
  await page.getByRole("button", { name: "Coimbatore" }).click();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.goto("/#/nearby");
  await expect(page.getByText("1 result in Coimbatore")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/#/listing/together/cup-club");
  await page.getByLabel("Your units").fill("8");
  await page.getByRole("button", { name: "Join group" }).click();
  await expect(
    page.getByRole("heading", { name: "₹1,039 per unit" }),
  ).toBeVisible();
  await page.goto("/#/listing/care/appliance");
  await page.getByLabel("Service date").fill("2099-01-01");
  await page.getByRole("button", { name: "Book demo service" }).click();
  await expect(page.getByText("Sample booking saved.")).toBeVisible();
});

test("post a requirement, accept a quotation and manage a business product", async ({
  page,
}) => {
  await page.goto("/#/connect?market=tiruppur");
  await page
    .getByLabel("Requirement", { exact: true })
    .fill("Plain canvas totes");
  await page.getByLabel("Total budget (₹)").fill("20000");
  await page.getByLabel("Quantity").fill("25");
  await page.getByLabel("Needed by").fill("2099-01-01");
  await page.getByRole("button", { name: "Post demo requirement" }).click();
  await page.getByRole("link", { name: "Compare sample quotations" }).click();
  await page.getByRole("button", { name: "Accept quote" }).first().click();
  await expect(
    page.getByText(/Accepted · Regional Supply Studio/),
  ).toBeVisible();
  await page.goto("/#/business/products");
  await page.getByLabel("Listing name").fill("Canvas tote");
  await page.getByLabel("Price (₹)").fill("450");
  await page.getByLabel("Stock or available slots").fill("10");
  await page.getByRole("button", { name: "Add demo listing" }).click();
  await page.getByRole("button", { name: "Publish locally" }).click();
  await expect(page.getByText(/Published/)).toBeVisible();
});

test("shareable catalogue filters and side-by-side product estimates", async ({
  page,
}) => {
  await page.goto("/#/shop");
  await page.getByLabel("Category").selectOption("Fashion & Apparel");
  await expect(page).toHaveURL(/category=Fashion/);
  await expect(page.getByText("5 results", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Compare products" }).click();
  await page.getByLabel("First product").selectOption("everyday-tote");
  await expect(page.getByText("₹998", { exact: true })).toBeVisible();
});

test("nearby distance and simulated stock confirmation", async ({ page }) => {
  await page.goto("/#/nearby");
  await page.getByLabel("Distance from city centre").selectOption("3");
  await expect(page.getByText("1 result in Chennai")).toBeVisible();
  await page
    .getByRole("link", { name: "Form & Frequency Studio", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Request stock check" }).click();
  await page.getByRole("link", { name: "View stock requests" }).click();
  await expect(page.getByText(/Pending/)).toBeVisible();
  await page
    .getByRole("button", { name: "Available · demo", exact: true })
    .click();
  await expect(page.getByText(/· Available · demo/)).toBeVisible();
});

for (const width of [360, 390, 768, 1024, 1440, 1920]) {
  test(`responsive layout at ${width}px`, async ({ page }, testInfo) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) problems.push(response.url());
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".hero-visual img")).toHaveJSProperty(
      "complete",
      true,
    );
    expect(
      await page
        .locator(".hero-visual img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);
    expect(
      await page.locator("body").evaluate((element) => element.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.goto("/#/shop");
    await expect(page.getByRole("heading", { name: "Shop" })).toBeVisible();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(width);
    expect(problems).toEqual([]);
    const names: Record<number, string> = {
      390: "mobile",
      768: "tablet",
      1440: "desktop",
    };
    if (names[width])
      await page.screenshot({
        path: testInfo.outputPath(`${names[width]}.png`),
        fullPage: true,
        animations: "disabled",
      });
  });
}
test("restores Shop price filters and list view from the URL", async ({ page }) => {
  await page.goto("./#/shop?maxPrice=1&sort=price-desc&view=list");
  await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("No listings match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".product-list .listing-card").first()).toBeVisible();
  await page.goBack();
  await expect(page.getByText("No listings match these filters.")).toBeVisible();
});
test("shows product image zoom, quantity validation and linked offers", async ({ page }) => {
  await page.goto("./#/listing/shop/studio-headphones");
  await page.getByRole("button", { name: "Enlarge product image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Quantity", { exact: true }).fill("100");
  await expect(page.getByRole("button", { name: "Add to cart", exact: true })).toBeDisabled();
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await expect(page.getByText(/Items subtotal/)).toBeVisible();
  await page.getByRole("link", { name: "Compare sourcing offers" }).click();
  await expect(page).toHaveURL(/sourcing\/product\/headphones/);
});

test("combines product facets and opens keyboard-accessible quick view", async ({ page }) => {
  await page.goto("./#/shop?brand=Clay+%26+Kiln&community=Deal+available&minPrice=bad&page=99");
  await expect(page.getByText("1 result", { exact: true })).toBeVisible();
  const trigger = page.getByRole("button", { name: "Quick view Handmade Stoneware Cups" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Variant").selectOption("gift");
  await expect(dialog.getByText(/8 in demo stock/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Remove Brand filter" }).click();
  await expect(page.getByText("2 results", { exact: true })).toBeVisible();
});

test("limits variant quantities and links eligible Together deals", async ({ page }) => {
  await page.goto("./#/listing/shop/stoneware-cups");
  await expect(page.getByRole("link", { name: "Join Group" })).toHaveAttribute("href", "#/listing/together/cup-club");
  await page.getByLabel("Variant").selectOption("Gift packaging");
  await expect(page.getByText(/stoneware-cups-gift/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Join Group" })).toHaveCount(0);
  await page.getByLabel("Quantity", { exact: true }).fill("9");
  await expect(page.getByRole("button", { name: "Add to cart", exact: true })).toBeDisabled();
});

test("supplier facets require a single matching offer and reset URL pagination", async ({ page }) => {
  await page.goto("./#/shop?supplierCity=Shenzhen&pickup=Chennai&page=9");
  await expect(page.getByText("No listings match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Remove Pickup location filter" }).click();
  await expect(page.getByText("1 result", { exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/page=/);
  await page.goBack();
  await expect(page.getByText("No listings match these filters.")).toBeVisible();
});
