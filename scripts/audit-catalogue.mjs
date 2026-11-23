import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { demoRetailProducts } from "../src/demo-retail.ts";

const assets = new URL("../public/images/products/", import.meta.url);
const unique = (values, field) =>
  assert.equal(new Set(values).size, 50, `Expected 50 distinct ${field}`);
assert.equal(demoRetailProducts.length, 50);
for (const field of ["id", "shopSlug", "name", "image"]) {
  unique(
    demoRetailProducts.map((item) => item[field]),
    field,
  );
}
const categories = new Map();
const hashes = [];
let bytes = 0;
for (const item of demoRetailProducts) {
  categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
  assert.ok(item.price > 0 || item.quoteOnly);
  assert.ok(item.specifications && Object.keys(item.specifications).length);
  const file = readFileSync(new URL(`${item.shopSlug}.webp`, assets));
  assert.equal(file.toString("ascii", 0, 4), "RIFF");
  assert.equal(file.toString("ascii", 8, 12), "WEBP");
  assert.ok(file.length <= 150_000, `Asset too large: ${item.shopSlug}`);
  bytes += file.length;
  hashes.push(createHash("sha256").update(file).digest("hex"));
}
assert.deepEqual([...categories.values()], Array(10).fill(5));
assert.equal(
  readdirSync(assets).filter((file) => file.endsWith(".webp")).length,
  50,
);
unique(hashes, "image hashes");
console.log(
  `Catalogue audit passed: 50 listings, 10 categories, 50 WebP images, ${Math.round(bytes / 1024)} KiB total.`,
);
