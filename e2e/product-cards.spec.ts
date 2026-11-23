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
  const imagePoint = async () => {
    const media = card.locator(".card-media");
    await media.scrollIntoViewIfNeeded();
    const bounds = (await media.boundingBox())!;
    return { x: bounds.x + 4, y: bounds.y + 4 };
  };
  const point = await imagePoint();
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
  const middlePoint = await imagePoint();
  const [middleTab] = await Promise.all([
    context.waitForEvent("page"),
    page.mouse.click(middlePoint.x, middlePoint.y, { button: "middle" }),
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
  const clickPoint = await imagePoint();
  await page.mouse.click(clickPoint.x, clickPoint.y);
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
  await page.getByRole("button", { name: "Page 2", exact: true }).click();
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
  await expect(page).toHaveURL(/#\/shop\?page=2$/);
  await page.getByRole("button", { name: "Page 1", exact: true }).click();
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

test("shows selected variant images and compact details in Quick View and cart", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/shop");
  await page.getByRole("button", { name: `Quick view ${product}` }).click();
  const dialog = page.getByRole("dialog");
  const image = dialog.getByRole("img", { name: product });
  await expect(image).toHaveAttribute("src", /headphones\.webp$/);
  await dialog.getByLabel("Variant").selectOption("gift");
  await expect(image).toHaveAttribute("src", /hero\.webp$/);
  await expect(dialog.getByText("SKU studio-headphones-gift")).toBeVisible();
  await dialog.getByRole("button", { name: "Add to Cart" }).click();
  await page.goto("/#/account/cart");
  const line = page.locator(".cart-line");
  await expect(line.getByRole("img", { name: product })).toHaveAttribute(
    "src",
    /hero\.webp$/,
  );
  await expect(line.getByText("SKU studio-headphones-gift")).toBeVisible();
  await expect(line.locator(".shopping-product-copy")).toHaveCSS("gap", "4px");
  expect(
    await page.locator("body").evaluate((body) => body.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
