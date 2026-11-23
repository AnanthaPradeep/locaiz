import { expect, test } from "@playwright/test";

test("footer links use the application routes and hide unconfigured social accounts", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  expect(await footer.getByRole("navigation").count()).toBe(4);
  for (const [label, route] of [
    ["LOCAIZ home", "/"],
    ["Shop", "/shop"],
    ["Nearby", "/nearby"],
    ["Global Atlas", "/sourcing"],
    ["Together", "/together"],
    ["Care", "/care"],
    ["Connect", "/connect"],
    ["My Profile", "/account/profile"],
    ["My Orders", "/account/orders"],
    ["Wishlist", "/account/wishlist"],
    ["My Requirements", "/account/requirements"],
    ["Settings", "/account/settings"],
    ["Contact Us", "/contact"],
    ["Help Centre", "/account/help"],
    ["Privacy Policy", "/account/privacy"],
    ["Terms & Conditions", "/account/terms"],
    ["About Us", "/about"],
    ["Become a Seller", "/business"],
  ]) {
    await expect(
      footer.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", `#${route}`);
  }
  await expect(
    footer.getByText(new RegExp(`© ${new Date().getFullYear()} LOCAIZ`)),
  ).toBeVisible();
  await footer.getByRole("link", { name: "About Us" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/about$/);
  await footer.getByRole("link", { name: "Contact Us" }).click();
  await expect(page).toHaveURL(/#\/contact$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/about$/);
  await page.goForward();
  await expect(page).toHaveURL(/#\/contact$/);
});

for (const width of [360, 390, 768, 1024, 1440, 1920]) {
  test(`footer fits at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width <= 900) {
      const link = footer.getByRole("link", { name: "Contact Us" });
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    if (width === 390 || width === 1440)
      await footer.screenshot({
        path: testInfo.outputPath(`footer-${width}.png`),
      });
  });
}

test("footer follows the theme and clears the fixed mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  const colour = await footer.evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.evaluate(() => {
    const root = document.querySelector("[data-theme]");
    root?.setAttribute("data-theme", "dark");
  });
  expect(await footer.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(colour);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const copyright = footer.locator(".site-footer-bottom");
  const bottomBar = page.getByRole("navigation", { name: "Quick navigation" });
  const footerBounds = (await copyright.boundingBox())!;
  const navBounds = (await bottomBar.boundingBox())!;
  expect(footerBounds.y + footerBounds.height).toBeLessThanOrEqual(navBounds.y);
});
