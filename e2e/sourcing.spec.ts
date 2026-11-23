import { expect, test } from "@playwright/test";

test("browses a village and saves a maker-direct sourcing enquiry", async ({
  page,
}) => {
  await page.goto("/#/sourcing");
  const child = page.getByRole("navigation", { name: "Child locations" });
  for (const place of ["Asia", "India", "Odisha", "Raghurajpur"]) {
    await child.getByRole("button", { name: place, exact: true }).click();
  }
  await page
    .getByRole("searchbox", { name: "Find products, places or makers" })
    .fill("cloth");
  await expect(page).toHaveURL(/q=cloth/);
  await page.getByRole("link", { name: "Village Brush Studio" }).click();
  await expect(
    page.getByRole("heading", { name: "Village Brush Studio" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Request custom order" }).click();
  await page.getByLabel(/Total budget/).fill("2500");
  await page.getByLabel("Needed by").fill("2099-01-01");
  await page.getByRole("button", { name: "Post demo requirement" }).click();
  await page.getByRole("link", { name: "Compare sample quotations" }).click();
  await expect(
    page.getByRole("heading", { name: "Village Brush Studio" }),
  ).toBeVisible();
});

test("shows a wholesale tier and preserves mobile and tablet layout", async ({
  page,
}) => {
  await page.goto("/#/sourcing?place=shenzhen&method=Wholesale");
  await page
    .getByRole("link", { name: "Microcontroller development board" })
    .click();
  await page.getByLabel("Offer quantity").fill("100");
  await expect(page.getByText(/32\.40 per unit/)).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.locator("body").evaluate((body) => body.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("saves a supplier draft without advertising it as verified", async ({
  page,
}) => {
  await page.goto("/#/business");
  await page.getByRole("link", { name: "Create supplier storefront" }).click();
  await page.getByLabel("Business name").fill("Example Loom");
  await page.getByLabel("Business description").fill("Demonstration workshop");
  const next = page.getByRole("button", { name: "Continue" });
  await next.click();
  await page.getByLabel("Business base").selectOption("pattamadai");
  await next.click();
  await page.getByLabel("Production speciality").fill("Hand weaving");
  await next.click();
  await page.getByLabel("Product name").fill("Handwoven mat");
  await next.click();
  await page.getByLabel("Delivery coverage").fill("Local pickup");
  await next.click();
  await page.getByRole("button", { name: "Save storefront draft" }).click();
  await expect(
    page.getByText("Storefront draft · Unverified", { exact: false }),
  ).toBeVisible();
});
