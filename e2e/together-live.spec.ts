import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test("@journey concurrent Together pledges respect capacity and need supplier acceptance", async ({
  page,
}) => {
  const password = process.env.LOCAIZ_PILOT_PASSWORD;
  test.skip(
    !password || process.env.VITE_MARKETPLACE_FOUNDATION !== "1",
    "Requires disposable Supabase",
  );
  await page.goto("/#/together/live");
  const auth = page.locator("main form");
  await auth.getByLabel("Email").fill("seller-b@stock.example.com");
  await auth.getByLabel("Password").fill(password!);
  await auth.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Managed business").selectOption({ label: "Journey Browser Supplier" });
  await page
    .getByText("Publish a supplier group offer", { exact: true })
    .click();
  await page
    .getByLabel("Published offer")
    .selectOption("33000000-0000-4000-8000-000000000001");
  await page.getByLabel("Group title").fill("Together CI capacity test");
  await page.getByLabel("Minimum group quantity").fill("2");
  await page.getByLabel("Maximum group quantity").fill("4");
  const end = new Date(Date.now() + 3600000);
  await page
    .getByLabel("Group deadline")
    .fill(
      new Date(end.getTime() - end.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
    );
  await page
    .getByRole("button", { name: "Publish group", exact: true })
    .click();
  const group = page.getByRole("link", { name: "Together CI capacity test" });
  await expect(group).toBeVisible();
  const id = (await group.getAttribute("href"))!.split("/").at(-1);
  const clients = await Promise.all(
    ["buyer-a", "buyer-b"].map(async (user) => {
      const db = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const login = await db.auth.signInWithPassword({
        email: user + "@stock.example.com",
        password: password!,
      });
      expect(login.error).toBeNull();
      return db;
    }),
  );
  const results = await Promise.all(
    clients.map((db) =>
      db.rpc("together_action", {
        command: "quantity",
        payload: { id, quantity: 3 },
      }),
    ),
  );
  expect(results.filter((result) => result.error === null)).toHaveLength(1);
  expect(results.find((result) => result.error)?.error?.message).toContain(
    "Group quantity limit reached",
  );
  await group.click();
  await expect(page.getByText(/3 pledged/)).toBeVisible();
  await expect(
    page.getByText("Supplier accepted group", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Accept group" }).click();
  await expect(
    page.getByText("Supplier accepted group", { exact: false }),
  ).toBeVisible();
});
