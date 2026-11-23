import { build } from "esbuild";
import { expect, test } from "@playwright/test";

test("footer links use the application routes and show unlinked icons by default", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  expect(await footer.getByRole("navigation").count()).toBe(4);
  const follow = footer.getByRole("region", { name: "Follow LOCAIZ" });
  await expect(follow.locator("svg")).toHaveCount(4);
  await expect(follow.getByRole("link")).toHaveCount(0);
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

test("footer follows the theme and clears the fixed mobile navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  const colour = await footer.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );
  await page.evaluate(() => {
    const root = document.querySelector("[data-theme]");
    root?.setAttribute("data-theme", "dark");
  });
  expect(
    await footer.evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe(colour);
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const copyright = footer.locator(".site-footer-bottom");
  const bottomBar = page.getByRole("navigation", { name: "Quick navigation" });
  const footerBounds = (await copyright.boundingBox())!;
  const navBounds = (await bottomBar.boundingBox())!;
  expect(footerBounds.y + footerBounds.height).toBeLessThanOrEqual(navBounds.y);
});

test("configured Follow LOCAIZ icons support keyboard, themes and new tabs", async ({
  page,
  context,
}) => {
  const fixtures = [
    {
      platform: "instagram",
      url: "https://www.instagram.com/test.fixture/",
      enabled: true,
    },
    {
      platform: "facebook",
      url: "https://www.facebook.com/test.fixture/",
      enabled: true,
    },
    {
      platform: "linkedin",
      url: "https://www.linkedin.com/company/test-fixture/",
      enabled: true,
    },
    {
      platform: "youtube",
      url: "https://www.youtube.com/@test-fixture",
      enabled: true,
    },
  ];
  const bundle = await build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { createRoot } from "react-dom/client";
        import { SocialLinks } from "./src/site-footer";
        document.querySelector(".footer-follow").remove();
        const mount = document.createElement("div");
        document.querySelector(".footer-brand").append(mount);
        createRoot(mount).render(createElement(SocialLinks, { profiles: ${JSON.stringify(fixtures)} }));
      `,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    jsx: "automatic",
    loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"production"' },
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await page.locator(".footer-brand").waitFor();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const follow = page.getByRole("region", { name: "Follow LOCAIZ" });
  await expect(
    follow.getByRole("heading", { name: "Follow LOCAIZ" }),
  ).toBeVisible();
  const links = follow.getByRole("link");
  await expect(links).toHaveCount(4);
  await links.first().focus();
  const positions = [];
  for (const [index, name] of [
    "Instagram",
    "Facebook",
    "LinkedIn",
    "YouTube",
  ].entries()) {
    const link = links.nth(index);
    await expect(link).toHaveAccessibleName(
      `LOCAIZ on ${name} (opens in a new tab)`,
    );
    await expect(link).toHaveAttribute("href", fixtures[index].url);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toBeFocused();
    await expect(link.locator("svg")).toHaveCSS("width", "22px");
    const box = (await link.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    positions.push(box);
    await page.keyboard.press("Tab");
  }
  expect(new Set(positions.map(({ y }) => y)).size).toBe(1);
  for (let i = 1; i < positions.length; i++) {
    expect(
      positions[i].x - positions[i - 1].x - positions[i - 1].width,
    ).toBeGreaterThanOrEqual(8);
  }
  const first = links.first();
  const light = await first
    .locator("svg")
    .evaluate((node) => getComputedStyle(node).fill);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  expect(
    await first.locator("svg").evaluate((node) => getComputedStyle(node).fill),
  ).not.toBe(light);
  await context.route(fixtures[0].url, (route) =>
    route.fulfill({ body: "Test profile" }),
  );
  const [tab] = await Promise.all([page.waitForEvent("popup"), first.click()]);
  await expect(tab).toHaveURL(fixtures[0].url);
  await tab.close();
});
