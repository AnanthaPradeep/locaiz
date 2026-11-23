import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.LOCAIZ_PILOT_PASSWORD;
const enabled = Boolean(
  url &&
  key &&
  password &&
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname),
);
const email = (account: string) => `${account}@stock.example.com`;
const shops = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
];

async function login(page: Page, account: string, route: string) {
  await page.goto(`/#${route}`);
  await page.getByLabel("Email").fill(email(account));
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(`Signed in as ${email(account)}`)).toBeVisible();
}

async function client(account?: string) {
  const db = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (account) {
    const result = await db.auth.signInWithPassword({
      email: email(account),
      password: password!,
    });
    expect(result.error).toBeNull();
  }
  return db;
}

test.describe("authenticated stock pilot @stock", () => {
  test.skip(!enabled, "Requires seeded local Supabase and pilot credentials");

  test("separate buyers and sellers receive durable independent replies", async ({
    browser,
    baseURL,
  }) => {
    const buyerContext = await browser.newContext({ baseURL });
    const shopAContext = await browser.newContext({ baseURL });
    const shopBContext = await browser.newContext({ baseURL });
    try {
      const buyer = await buyerContext.newPage();
      const shopA = await shopAContext.newPage();
      const shopB = await shopBContext.newPage();
      let buyerRevision = 0;
      buyer.on("websocket", (socket) => {
        socket.on("framereceived", ({ payload }) => {
          const frame = payload.toString();
          if (
            frame.includes('"postgres_changes"') &&
            frame.includes('"stock_feed"') &&
            frame.includes('"record"')
          ) {
            buyerRevision++;
          }
        });
      });
      await login(shopA, "seller-a", "/business/stock");
      await expect(
        shopA.getByText("Live stock updates connected"),
      ).toBeVisible();
      await buyer.goto("/#/listing/shop/studio-headphones");
      await buyer
        .getByRole("link", { name: "Check Nearby Stock", exact: true })
        .click();
      await buyer.getByLabel("Email").fill(email("buyer-a"));
      await buyer.getByLabel("Password").fill(password!);
      await buyer.getByRole("button", { name: "Sign in", exact: true }).click();
      await buyer.getByLabel("Pilot Shop A", { exact: false }).check();
      await buyer.getByLabel("Pilot Shop B", { exact: false }).check();
      await buyer
        .getByLabel("Message to shops")
        .fill("Browser pilot acceptance");
      await buyer.getByRole("button", { name: "Send stock request" }).click();
      await expect(buyer.getByText(/Request sent ·/)).toBeVisible();
      await expect(
        buyer.getByText("Live stock updates connected"),
      ).toBeVisible();
      const assigned = (page: Page) =>
        page
          .locator("article")
          .filter({ hasText: "Browser pilot acceptance" })
          .first();
      const card = assigned(shopA);
      await expect(card)
        .toBeVisible({ timeout: 12000 })
        .catch(async (error) => {
          const inbox = await shopA.locator("main").innerText();
          throw new Error(`${error.message}\nSeller inbox state:\n${inbox}`);
        });
      await card
        .getByRole("button", { name: "Available", exact: true })
        .click();
      await shopA.getByLabel("Quoted price (INR)").fill("1250");
      const ready = new Date(Date.now() + 3600000);
      const localTime = new Date(
        ready.getTime() - ready.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);
      await shopA.getByLabel("Pickup ready time").fill(localTime);
      const beforeReply = buyerRevision;
      await shopA.getByRole("button", { name: "Send reply" }).click();
      await expect(buyer.getByText(/₹1,250\.00 quoted/)).toBeVisible({
        timeout: 12000,
      });
      await expect(
        buyer.getByText("Partially responded · 2 assigned · 1 pending"),
      ).toBeVisible();
      await expect
        .poll(() => buyerRevision, {
          timeout: 12000,
          message:
            "Expected a Supabase Realtime revision after the seller replied",
        })
        .toBeGreaterThan(beforeReply);
      await buyerContext.setOffline(true);
      await login(shopB, "seller-b", "/business/stock");
      await assigned(shopB)
        .getByRole("button", { name: "Out of stock", exact: true })
        .click();
      await shopB.getByLabel("Seller note").fill("Next delivery pending");
      await shopB.getByRole("button", { name: "Send reply" }).click();
      await expect(
        assigned(shopB).getByText("Seller note · Next delivery pending"),
      ).toBeVisible();
      await buyerContext.setOffline(false);
      await expect(
        buyer.getByText("All responded · 2 assigned · 0 pending"),
      ).toBeVisible({ timeout: 12000 });
      await expect(buyer.getByText(/^Replied /)).toHaveCount(2);
      await buyer.reload();
      await shopA.reload();
      await expect(
        buyer.getByText("Seller note · Next delivery pending"),
      ).toBeVisible();
      await expect(
        assigned(shopA).getByText(/₹1,250\.00 quoted/),
      ).toBeVisible();
    } finally {
      await Promise.all([
        buyerContext.close(),
        shopAContext.close(),
        shopBContext.close(),
      ]);
    }
  });

  test("RLS and validated writes reject cross-account access and bad requests", async () => {
    const [buyer, other, seller, sellerB, guest] = await Promise.all([
      client("buyer-a"),
      client("buyer-b"),
      client("seller-a"),
      client("seller-b"),
      client(),
    ]);
    const payload = {
      submission: crypto.randomUUID(),
      pilot: "nagercoil",
      product: "studio-headphones",
      selected_variant: "Standard",
      shops,
      units: 1,
    };
    expect(
      (await buyer.rpc("create_stock_request", { ...payload, units: 0 })).error,
    ).toBeTruthy();
    const result = await buyer.rpc("create_stock_request", payload);
    expect(result.error).toBeNull();
    const id = result.data as string;
    expect((await buyer.rpc("create_stock_request", payload)).data).toBe(id);
    const assignments = await buyer
      .from("stock_request_shops")
      .select("id,business_id")
      .eq("request_id", id);
    expect(assignments.data).toHaveLength(2);
    expect(
      (await guest.from("stock_requests").select("id").eq("id", id)).error,
    ).toBeTruthy();
    expect(
      (await other.from("stock_requests").select("id").eq("id", id)).data,
    ).toEqual([]);
    expect(
      (
        await other
          .from("stock_request_shops")
          .select("id")
          .eq("request_id", id)
      ).data,
    ).toEqual([]);
    const first = assignments.data!.find(
      (row) => row.business_id === shops[0],
    )!.id;
    const second = assignments.data!.find(
      (row) => row.business_id === shops[1],
    )!.id;
    expect(
      (
        await seller
          .from("stock_request_shops")
          .select("id")
          .eq("request_id", id)
      ).data,
    ).toEqual([{ id: first }]);
    const memberships = await seller.rpc("my_stock_businesses");
    expect(memberships.error).toBeNull();
    expect(memberships.data).toEqual([shops[0]]);
    const inbox = await seller
      .from("stock_requests")
      .select("id,stock_request_shops!inner(id,business_id)")
      .in("stock_request_shops.business_id", memberships.data)
      .eq("id", id);
    expect(inbox.error).toBeNull();
    expect(inbox.data).toEqual([
      { id, stock_request_shops: [{ id: first, business_id: shops[0] }] },
    ]);
    expect(
      (
        await seller.rpc("reply_stock_request", {
          assignment: second,
          outcome: "out_of_stock",
        })
      ).error,
    ).toBeTruthy();
    expect(
      (
        await buyer.rpc("reply_stock_request", {
          assignment: first,
          outcome: "out_of_stock",
        })
      ).error,
    ).toBeTruthy();
    expect(
      (await seller.from("stock_requests").update({ quantity: 7 }).eq("id", id))
        .error,
    ).toBeTruthy();
    expect(
      (
        await seller.rpc("reply_stock_request", {
          assignment: first,
          outcome: "available",
          amount: "-1",
          currency_code: "INR",
          pickup_time: new Date(Date.now() + 3600000).toISOString(),
        })
      ).error,
    ).toBeTruthy();
    const reply = {
      assignment: first,
      outcome: "out_of_stock",
      seller_note: "First reply",
    };
    expect((await seller.rpc("reply_stock_request", reply)).error).toBeNull();
    expect(
      (
        await seller.rpc("reply_stock_request", {
          ...reply,
          seller_note: "Duplicate",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await buyer
          .from("stock_request_shops")
          .select("note")
          .eq("id", first)
          .single()
      ).data,
    ).toEqual({ note: "First reply" });
    expect(
      (await other.rpc("cancel_stock_request", { request_key: id })).error,
    ).toBeTruthy();
    expect(
      (await buyer.rpc("cancel_stock_request", { request_key: id })).error,
    ).toBeNull();
    expect(
      (
        await sellerB.rpc("reply_stock_request", {
          assignment: second,
          outcome: "out_of_stock",
        })
      ).error,
    ).toBeTruthy();
    const expiring = await buyer.rpc("create_stock_request", {
      ...payload,
      submission: crypto.randomUUID(),
    });
    expect(expiring.error).toBeNull();
    const expiredId = String(expiring.data);
    expect(expiredId).toMatch(/^[a-f0-9-]{36}$/);
    const expiredShop = await seller
      .from("stock_request_shops")
      .select("id")
      .eq("request_id", expiredId)
      .single();
    const sql = `update public.stock_requests set created_at = now() - interval '2 days', expires_at = now() - interval '1 day' where id = '${expiredId}';`;
    const db = spawnSync(
      "docker",
      [
        "exec",
        "-i",
        "supabase_db_locaiz",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { input: sql, encoding: "utf8" },
    );
    expect(db.status, db.stderr).toBe(0);
    expect(
      (
        await seller.rpc("reply_stock_request", {
          assignment: expiredShop.data!.id,
          outcome: "out_of_stock",
        })
      ).error?.message,
    ).toBe("Request is closed");
  });
});
