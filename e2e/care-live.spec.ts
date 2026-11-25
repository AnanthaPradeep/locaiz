import { expect, test, type Page } from "@playwright/test";

test("@journey a provider publishes availability, accepts a booking and reads its private message", async ({
  browser,
  baseURL,
}) => {
  const password = process.env.LOCAIZ_PILOT_PASSWORD;
  test.skip(
    !password || process.env.VITE_MARKETPLACE_FOUNDATION !== "1",
    "Requires disposable Supabase",
  );
  const buyer = await browser.newContext({ baseURL });
  const seller = await browser.newContext({ baseURL });
  async function login(page: Page, user: string) {
    await page.goto("/#/care/live");
    const form = page.locator("main form");
    await form.getByLabel("Email").fill(user + "@stock.example.com");
    await form.getByLabel("Password").fill(password!);
    await form.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  const local = (delta: number) => {
    const when = new Date(Date.now() + delta);
    return new Date(when.getTime() - when.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  try {
    const s = await seller.newPage();
    const b = await buyer.newPage();
    await login(s, "seller-b");
    await s.getByText("Publish service profile", { exact: true }).click();
    await s.getByLabel("Service title").fill("Care CI lamp repair");
    await s.getByLabel("Geographic coverage").fill("Chennai");
    await s
      .getByLabel("Service description")
      .fill("Estimate after checking the lamp.");
    await s
      .getByRole("button", { name: "Publish service", exact: true })
      .click();
    await s.getByText("Add appointment availability", { exact: true }).click();
    await s.getByLabel("Starts at").fill(local(3600000));
    await s.getByLabel("Ends at").fill(local(7200000));
    await s.getByRole("button", { name: "Publish appointment slot" }).click();
    await expect(s.getByText("Availability published.")).toBeVisible();

    await login(b, "buyer-b");
    await b.getByText("Request an appointment", { exact: true }).click();
    await b.getByLabel("Appointment slot").selectOption({ index: 1 });
    await b
      .getByRole("button", { name: "Request booking", exact: true })
      .click();
    await b.getByText("Booking messages", { exact: true }).click();
    await b
      .getByLabel("Private message")
      .fill("The lamp has a loose connection.");
    await b.getByRole("button", { name: "Send booking message" }).click();

    await s.reload();
    await s.getByRole("button", { name: "Accept booking" }).click();
    await s.getByText("Booking messages", { exact: true }).click();
    await expect(s.getByText("The lamp has a loose connection.")).toBeVisible();
    await b.reload();
    await expect(b.getByText(/accepted at/)).toBeVisible();
  } finally {
    await Promise.all([buyer.close(), seller.close()]);
  }
});
