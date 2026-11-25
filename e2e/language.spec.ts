import { expect, test } from "@playwright/test";

test("language changes preserve current form input and persist across reload", async ({
  page,
}) => {
  await page.goto("/#/shop");
  const language = page.locator(".locale-select select");
  const input = page.locator(".catalogue-search input");
  await input.fill("headphones");
  await language.selectOption("ta");
  await expect(page.locator("html")).toHaveAttribute("lang", "ta");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("கடை");
  await expect(input).toHaveValue("headphones");
  await language.selectOption("ml");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("കട");
  await expect(input).toHaveValue("headphones");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ml");
  await expect(language).toHaveValue("ml");
  await language.selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shop");
});

test("mobile language switch and translated navigation fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle marketplace menu" }).click();
  await page.locator(".locale-select select").selectOption("ml");
  await expect(page.locator("html")).toHaveAttribute("lang", "ml");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
