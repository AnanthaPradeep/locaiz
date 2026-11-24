import { expect, test } from "@playwright/test";

test("saves zero results, reopens filters, and alerts once for each new sample", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, query] of [
    ["shop", "Alabaster Match Demo Lamp"],
    ["sourcing", "Demo restock offer"],
  ]) {
    await page.goto("./#/" + route + "?" + new URLSearchParams({ q: query }));
    await page.getByRole("button", { name: "Save this search" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save search", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.goto("./#/account/saved-searches");
  const lamp = page
    .locator("article")
    .filter({ hasText: "Alabaster Match Demo Lamp" });
  await expect(lamp.getByRole("link", { name: "Open search" })).toHaveAttribute(
    "href",
    /q=Alabaster/,
  );
  await lamp.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Search name").fill("My lamp search");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save search", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My lamp search" }),
  ).toBeVisible();
  await page.getByText("Demo match simulator", { exact: true }).click();
  await page.getByRole("button", { name: "Publish demo samples" }).click();
  await page.getByRole("button", { name: "Check for new matches" }).click();
  await page.goto("./#/account/notifications");
  const alerts = page.getByRole("region", { name: "Match alerts" });
  await expect(alerts.getByText("2 unread · Demo Mode")).toBeVisible();
  await expect(alerts.getByRole("link", { name: "View match" })).toHaveCount(2);
  await page.reload();
  await expect(alerts.getByRole("link", { name: "View match" })).toHaveCount(2);
  await alerts
    .getByRole("button", { name: "Mark all match alerts as read" })
    .click();
  await expect(alerts.getByText("0 unread · Demo Mode")).toBeVisible();
  await alerts.getByRole("link", { name: "View match" }).first().click();
  await expect(page).toHaveURL(/demo-match-reed-mat-offer/);
  await expect(page.locator("#demo-match-reed-mat-offer")).toBeVisible();
  await page.goto("./#/account/notifications");
  await alerts.getByRole("link", { name: "View match" }).last().click();
  await expect(page.getByRole("heading", { name: "Alabaster Match Demo Lamp", level: 1 })).toBeVisible();
});

test("a paused search baselines current results on resume", async ({
  page,
}) => {
  await page.goto("./#/search?q=Alabaster+Match+Demo+Lamp");
  await page.getByRole("button", { name: "Save this search" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save search", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Saved searches", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByText("Demo match simulator", { exact: true }).click();
  await page.getByRole("button", { name: "Publish demo samples" }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.goto("./#/account/notifications");
  await expect(page.getByText("No new matches yet.")).toBeVisible();
  await page.goto("./#/account/saved-searches");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete search" })
    .click();
  await expect(page.getByText("No saved searches yet.")).toBeVisible();
});

test("updates an existing Shop search with discovery filters and supports theme and widths", async ({ page }) => {
  await page.goto("./#/shop?q=lamp");
  await page.getByRole("button", { name: "Save this search" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save search", exact: true }).click();
  await page.goto("./#/account/saved-searches");
  await page.getByRole("link", { name: "Edit using search filters" }).click();
  await page.getByRole("searchbox", { name: "Search products" }).fill("walnut lamp");
  await page.getByRole("button", { name: "Update saved search" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save search", exact: true }).click();
  await page.goto("./#/account/saved-searches");
  await expect(page.getByRole("link", { name: "Open search" })).toHaveAttribute("href", /q=walnut\+lamp/);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
