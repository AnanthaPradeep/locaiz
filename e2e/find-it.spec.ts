import { expect, test } from "@playwright/test";

test("opens Find It Your Way from Home and carries a selected retail variant to PDP", async ({
  page,
}) => {
  await page.goto("/#/");
  await page
    .getByLabel("What are you looking for?")
    .fill("Wireless headphones");
  await page.getByRole("button", { name: "Find a product" }).click();
  await expect(
    page.getByRole("heading", { name: "Find It Your Way" }),
  ).toBeVisible();
  await page.goto(
    "/#/search?find=1&q=wireless+headphones&item=studio-headphones&sku=gift&qty=3",
  );
  await page.reload();
  await page.getByRole("link", { name: "Studio Wireless Headphones" }).click();
  await expect(
    page.getByRole("region", { name: "Buying options" }),
  ).toContainText("Gift packaging / 3 units");
});

test("reviews a custom machine request, preserves the buyer brief, and reopens quotations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/#/search?find=1&q=Custom+machined+shaft+coupling&qty=50&city=Chennai&destination=IN&needed=2099-01-10&customNotes=Steel+20mm",
  );
  await expect(
    page.getByText("No matching ready-made products.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Source or make to order/ }).click();
  await page
    .getByRole("link", { name: "Request quote", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("50");
  await expect(page.getByLabel("Needed by")).toHaveValue("2099-01-10");
  await expect(page.getByLabel("Specifications and notes")).toHaveValue(
    "Steel 20mm",
  );
  await page.getByRole("button", { name: "Review requirement" }).click();
  await expect(
    page.getByRole("region", { name: "Requirement review" }),
  ).toContainText("Steel 20mm");
  await page.getByRole("button", { name: "Save demo requirement" }).click();
  await page.getByRole("link", { name: "Compare sample quotations" }).click();
  await expect(page.getByText("50 units", { exact: false })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("offers a broader basket search and preserves dates and quantity in Saved Searches", async ({
  page,
}) => {
  await page.goto(
    "/#/search?find=1&q=handmade+baskets&qty=20&city=Chennai&needed=2099-01-10",
  );
  await page
    .getByRole("link", { name: "Search more broadly for baskets" })
    .click();
  await expect(
    page.getByRole("link", { name: "Natural Rattan Storage Basket" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save this search" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save search", exact: true })
    .click();
  await page.getByRole("link", { name: "Saved searches", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open search" })).toHaveAttribute(
    "href",
    /qty=20/,
  );
  await expect(page.getByRole("link", { name: "Open search" })).toHaveAttribute(
    "href",
    /needed=2099-01-10/,
  );
});
