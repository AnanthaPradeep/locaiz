import { expect, test } from "@playwright/test";

test("homepage campaigns appear in order and open matching destinations", async ({
  page,
}) => {
  await page.goto("/#/");
  const section = page.getByRole("region", { name: "Featured collections" });
  const sections = await page
    .locator("main > section")
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  const position = sections.findIndex((label) =>
    label.includes("Crafted Close to Home"),
  );
  expect(sections[position - 1]).toContain("Shop");
  expect(sections[position + 1]).toContain("Trending finds");

  for (const [label, keys] of [
    ["Explore handmade", ["Handmade & Regional"]],
    ["Shop tech", ["Electronics & Audio", "Computer & Mobile Accessories"]],
    ["Explore suppliers", ["Wholesale and industrial"]],
  ] as const) {
    await section.getByRole("link", { name: label }).click();
    const url = new URL(page.url());
    const [path, rawQuery] = url.hash.slice(1).split("?");
    expect(path).toBe(label === "Explore suppliers" ? "/sourcing" : "/shop");
    expect(new URLSearchParams(rawQuery).getAll("category")).toEqual([...keys]);
    if (path === "/shop") {
      const departments = page.getByRole("navigation", {
        name: "Shop departments",
      });
      for (const key of keys)
        await expect(
          departments.getByRole("button", { name: key, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.locator(".catalogue-results .listing-card").first(),
      ).toBeVisible();
    } else {
      await expect(page.getByText(/sample offers from/)).toBeVisible();
    }
    await page.goBack();
  }
});

test("campaign browser crops, theme, keyboard focus and layout work across breakpoints", async ({
  page,
}) => {
  await page.goto("/#/");
  const section = page.getByRole("region", { name: "Featured collections" });
  await section.scrollIntoViewIfNeeded();
  const main = section.locator(".home-campaign--featured img");
  const cards = section.locator(".home-campaign--collection");
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => main.evaluate((image: HTMLImageElement) => image.currentSrc))
      .toContain(
        width <= 650
          ? "crafted-close-home-mobile.webp"
          : "crafted-close-home-desktop.webp",
      );
    await expect
      .poll(() =>
        main.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const [first, second] = await cards.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().top),
    );
    expect(second > first).toBe(width <= 650);
  }
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const links = section.getByRole("link");
  await links.first().focus();
  await expect(links.first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(links.nth(1)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(links.nth(2)).toBeFocused();
});
