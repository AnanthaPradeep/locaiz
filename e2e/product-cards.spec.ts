import { expect, test } from "@playwright/test";

const shop = "/#/shop?category=Electronics";
const product = "Studio Wireless Headphones";
const detail = /#\/listing\/shop\/studio-headphones$/;

test("product card uses one native anchor over its image and whitespace", async ({
  page,
  context,
}) => {
  await page.goto(shop);
  const card = page.locator(".listing-card").filter({ hasText: product });
  const link = card.getByRole("link", { name: product });
  await expect(card.locator("a")).toHaveCount(1);
  await expect(link).toHaveAttribute(
    "href",
    "#/listing/shop/studio-headphones",
  );
  const bounds = (await card.boundingBox())!;
  const point = { x: bounds.x + 4, y: bounds.y + 4 };
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href"),
      point,
    ),
  ).toBe("#/listing/shop/studio-headphones");
  await page.mouse.click(point.x, point.y, { button: "right" });
  await expect(page).toHaveURL(/category=Electronics$/);
  await page.keyboard.press("Escape");
  const [newTab] = await Promise.all([
    context.waitForEvent("page"),
    link.click({ modifiers: ["ControlOrMeta"] }),
  ]);
  await expect(newTab).toHaveURL(detail);
  await newTab.close();
  const [middleTab] = await Promise.all([
    context.waitForEvent("page"),
    page.mouse.click(point.x, point.y, { button: "middle" }),
  ]);
  await expect(middleTab).toHaveURL(detail);
  await middleTab.close();
  const whitespace = await card.locator(".card-copy").evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    return { x: bounds.x + 5, y: bounds.bottom - 5 };
  });
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href"),
      whitespace,
    ),
  ).toBe("#/listing/shop/studio-headphones");
  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(detail);
  await page.goBack();
  await link.click();
  await expect(page).toHaveURL(detail);
  await page.goBack();
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(detail);
});

test("card heart persists and cart selects an available variant without navigation", async ({
  page,
}) => {
  await page.goto(shop);
  const card = page.locator(".listing-card").filter({ hasText: product });
  await card
    .getByRole("button", { name: `Add ${product} to wishlist` })
    .click();
  const saved = card.getByRole("button", {
    name: `Remove ${product} from wishlist`,
  });
  await expect(saved).toHaveAttribute("aria-pressed", "true");
  await expect(saved.locator("svg")).toHaveAttribute("fill", "currentColor");
  await expect(
    page.getByRole("link", { name: "Wishlist, 1 saved products" }),
  ).toBeVisible();
  await page.reload();
  await expect(saved).toHaveAttribute("aria-pressed", "true");
  await saved.click();
  await expect(
    card.getByRole("button", { name: `Add ${product} to wishlist` }),
  ).toHaveAttribute("aria-pressed", "false");

  const add = card.getByRole("button", { name: "Add to Cart" });
  await add.click();
  const dialog = page.getByRole("dialog", { name: /Choose a variant/ });
  await dialog.getByLabel("Variant").selectOption("gift");
  await expect(dialog.getByText(/SKU studio-headphones-gift/)).toBeVisible();
  await dialog.getByRole("button", { name: "Add to Cart" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(add).toBeFocused();
  await expect(card.getByRole("status")).toContainText("Gift packaging");
  await expect(page).toHaveURL(/category=Electronics$/);
  await page.getByRole("link", { name: "Cart, 1 items" }).click();
  await expect(page.getByText(/Gift packaging.*per unit/)).toBeVisible();
});

test("single purchasable variant adds directly and respects its remaining stock", async ({
  page,
}) => {
  await page.goto("/#/shop");
  const lamp = page
    .locator(".listing-card")
    .filter({ hasText: "Walnut Globe Table Lamp" });
  const add = lamp.getByRole("button", { name: "Add to Cart" });
  for (let count = 1; count <= 10; count++) {
    await add.click();
    await expect(
      page.getByRole("link", { name: `Cart, ${count} items` }),
    ).toBeVisible();
  }
  await expect(add).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/#\/shop$/);
  const pads = page
    .locator(".listing-card")
    .filter({ hasText: "Studio Headphone Replacement Pads" });
  await expect(
    pads.getByRole("button", { name: "Add to Cart" }),
  ).toBeDisabled();
});

test("Quick View keeps the card heart and cart in sync", async ({ page }) => {
  await page.goto(shop);
  const card = page.locator(".listing-card").filter({ hasText: product });
  const quick = card.getByRole("button", { name: `Quick view ${product}` });
  await quick.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Variant").selectOption("gift");
  await dialog.getByRole("button", { name: "Wishlist" }).click();
  await dialog.getByRole("button", { name: "Add to Cart" }).click();
  await expect(dialog.getByRole("status")).toContainText("Added");
  await page.keyboard.press("Escape");
  await expect(quick).toBeFocused();
  await expect(
    card.getByRole("button", { name: `Remove ${product} from wishlist` }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Cart, 1 items" })).toBeVisible();
  await expect(page).toHaveURL(/category=Electronics$/);
});
