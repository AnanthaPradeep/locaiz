import { expect, test } from "@playwright/test";

test("Shop paginates fifty unique products and serves every primary photo", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  await page.goto("/#/shop");
  const grid = page.locator(".catalogue-results .product-grid");
  const identities = new Map<string, string>();
  for (let number = 1; number <= 5; number++) {
    if (number > 1)
      await page
        .getByRole("button", { name: `Page ${number}`, exact: true })
        .click();
    const first = (number - 1) * 12 + 1;
    const last = Math.min(number * 12, 50);
    await expect(page.locator(".catalogue-range")).toHaveText(
      `Showing ${first}–${last} of 50 products`,
    );
    await expect(grid.locator(".listing-card")).toHaveCount(
      number === 5 ? 2 : 12,
    );
    const cards = await grid.locator(".listing-card").evaluateAll((items) =>
      items.map((card) => ({
        href: card.querySelector("a")?.getAttribute("href"),
        title: card.querySelector(".card-product-link strong")?.textContent,
        image: card.querySelector("img")?.src,
      })),
    );
    for (const card of cards) {
      expect(card.href).toMatch(/^#\/listing\/shop\//);
      expect(card.image).toMatch(/\/images\/products\/.*\.webp$/);
      expect(card.title).toBeTruthy();
      identities.set(card.href!, card.title!);
    }
    await Promise.all(
      cards.map(async ({ image }) => {
        const response = await request.get(image!);
        expect(response.ok()).toBeTruthy();
        expect(response.headers()["content-type"]).toContain("image/webp");
      }),
    );
  }
  expect(identities.size).toBe(50);
  await expect(page.getByText("Showing 49–50 of 50 products")).toBeVisible();
  for (const [href, title] of identities) {
    await page.goto("/" + href);
    await expect(page.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
    await expect(page.locator(".detail-image")).toBeVisible();
    await expect(page.getByText("Product specifications", { exact: true })).toBeVisible();
  }

  await expect(
    page.getByRole("heading", { name: "Benchtop CNC Router" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Request quotation" }),
  ).toHaveAttribute("href", /#\/connect/);
});

test("multi-select department filters combine with price and persist in the URL", async ({
  page,
}) => {
  await page.goto("/#/shop?page=5");
  const departments = page.getByRole("navigation", {
    name: "Shop departments",
  });
  await departments.getByRole("button", { name: "Fashion & Apparel" }).click();
  await departments.getByRole("button", { name: "Bags & Accessories" }).click();
  await expect(page.getByText("10 results", { exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/page=/);
  await page.getByLabel(/Maximum price/).fill("1000");
  await expect(page.getByText("3 results", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("3 results", { exact: true })).toBeVisible();
});
