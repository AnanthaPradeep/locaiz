import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const {
  VITE_SUPABASE_URL: url,
  LOCAIZ_LOCAL_ADMIN_KEY: key,
  LOCAIZ_PILOT_PASSWORD: password,
} = process.env;
if (
  !url ||
  !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname) ||
  !key ||
  !password ||
  password.length < 12
) {
  throw new Error(
    "Use a loopback Supabase API URL, its local admin key and a test password of at least 12 characters.",
  );
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const existing = await db.auth.admin.listUsers({ perPage: 100 });
if (existing.error) throw existing.error;
const shops = [];
for (const label of [
  "buyer-a",
  "buyer-b",
  "seller-a",
  "seller-b",
  "seller-c",
]) {
  const email = `${label}@stock.example.com`;
  const account = existing.data.users.find((user) => user.email === email);
  const result = account
    ? await db.auth.admin.updateUserById(account.id, {
        password,
        email_confirm: true,
      })
    : await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error) throw result.error;
  if (label.startsWith("seller")) shops.push(result.data.user.id);
}

const assignments = shops
  .map((id, index) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Unexpected user ID");
    const business = `00000000-0000-4000-8000-00000000000${index + 1}`;
    const name = `Pilot Shop ${"ABC"[index]}`;
    return `
    insert into public.stock_businesses(id, pilot_id, name, is_demo, active)
    values ('${business}', 'nagercoil', '${name}', true, true) on conflict (id) do nothing;
    insert into stock_private.business_members(business_id, user_id)
    values ('${business}', '${id}') on conflict do nothing;
  `;
  })
  .join("\n");
const seed = spawnSync(
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
  {
    input: "begin;\n" + assignments + "\ncommit;",
    encoding: "utf8",
  },
);
if (seed.status !== 0)
  throw new Error(
    seed.error?.message || seed.stderr || "Local pilot seeding failed.",
  );
console.log(
  "Local stock pilot seeded with five test accounts and three labelled test shops.",
);
