import { expect, test } from "@playwright/test";

test("@journey verified Nearby uses a shared list and map after location is denied", async ({
  page,
}) => {
  test.skip(
    !process.env.LOCAIZ_PILOT_PASSWORD ||
      process.env.VITE_MARKETPLACE_FOUNDATION !== "1",
    "Requires disposable Supabase",
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _success: PositionCallback,
          error: PositionErrorCallback,
        ) => error({ code: 1, message: "Denied" } as GeolocationPositionError),
      },
    });
  });
  await page.goto("/#/nearby");
  const nearby = page.getByRole("region", { name: "Verified nearby shops" });
  await nearby.getByRole("button", { name: "Use my location" }).click();
  await expect(
    nearby.getByText(
      "Location access is unavailable. Enter a city to continue.",
    ),
  ).toBeVisible();
  await nearby.getByLabel("City or locality").fill("Kottar");
  await expect(
    nearby.getByRole("heading", { name: "Verified Browser Shop" }),
  ).toBeVisible();
  await expect(nearby.getByText(/09:00 to 18:00/)).toBeVisible();
  await nearby.getByRole("button", { name: "Show shop map" }).click();
  await expect(nearby.getByLabel("Map of selected listings")).toBeVisible();
  await nearby.getByLabel("City or locality").fill("No matching city");
  await expect(
    nearby.getByRole("heading", { name: "Verified Browser Shop" }),
  ).toHaveCount(0);
  await expect(nearby.getByLabel("Map of selected listings")).toHaveCount(0);
  await nearby.getByLabel("City or locality").fill("Kottar");
  await nearby
    .getByLabel("Product for stock checks")
    .selectOption("studio-headphones");
  await expect(
    nearby.getByText("Stock unconfirmed for the selected product"),
  ).toBeVisible();
  await expect(
    nearby.getByRole("link", { name: "Check stock at this shop" }),
  ).toHaveAttribute("href", /shop=34000000-0000-4000-8000-000000000010/);
});
