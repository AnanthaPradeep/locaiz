import { expect, test } from "@playwright/test";

test("legacy About opens the editorial page and its marketplace links", async ({
  page,
}) => {
  await page.goto("/#/account/about");
  await expect(page).toHaveURL(/#\/about$/);
  await expect(
    page.getByRole("heading", { name: "Commerce begins everywhere." }),
  ).toBeVisible();
  await page.getByText("What is LOCAIZ?", { exact: true }).click();
  await expect(
    page.getByText(
      "A marketplace for discovering products, makers, suppliers and services.",
    ),
  ).toBeVisible();
  const links = page.locator(".info-grid > a");
  await expect(links).toHaveCount(7);
  for (const route of [
    "/shop",
    "/nearby",
    "/sourcing",
    "/together",
    "/care",
    "/connect",
    "/business",
  ]) {
    await expect(page.locator(`.info-grid > a[href="#${route}"]`)).toBeVisible();
  }
});

test("Contact routes categories and validates without sending a preview", async ({
  page,
}) => {
  await page.goto("/#/contact");
  await page.getByRole("button", { name: /Manufacturer & Wholesale/ }).click();
  await expect(
    page.getByRole("link", { name: "Open LOCAIZ Connect" }),
  ).toHaveAttribute("href", "#/connect");
  await expect(page.getByLabel("Business name (optional)")).toBeVisible();
  await page.getByLabel("Email address").fill("invalid");
  await page.getByRole("button", { name: "Check form" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Enter a message.")).toBeVisible();
  await page.getByLabel("Full name").fill("Sample Buyer");
  await page.getByLabel("Email address").fill("sample@example.test");
  await page.getByLabel("Subject").fill("Sample enquiry");
  await page
    .getByRole("textbox", { name: /^Message/ })
    .fill("This is sample information.");
  await page.getByRole("button", { name: "Check form" }).click();
  await expect(page.getByRole("status")).toContainText("no submission channel");
});

for (const width of [360, 390, 768, 1024, 1440, 1920]) {
  test(`information pages fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, heading] of [
      ["about", "Commerce begins everywhere."],
      ["contact", "Every connection starts somewhere."],
    ]) {
      await page.goto(`/#/${route}`);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: testInfo.outputPath(`${route}-${width}.png`),
          fullPage: true,
        });
    }
  });
}
