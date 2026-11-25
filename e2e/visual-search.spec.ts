import { expect, test } from "@playwright/test";

test("ranks an identical catalogue photo first while keeping the selected file local", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/#/search/image");
  const input = page.getByLabel("Choose product photo");
  await input.setInputFiles({
    name: "false.webp",
    mimeType: "image/webp",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("valid JPEG");
  await input.setInputFiles("public/images/products/studio-headphones.webp");
  await expect(
    page.getByRole("img", { name: "Selected product preview" }),
  ).toBeVisible();
  await page.getByLabel("Category").selectOption("Electronics & Audio");
  await page.getByRole("button", { name: "Find similar products" }).click();
  const matches = page.getByRole("region", { name: "Visual matches" });
  await expect(matches.getByRole("link").first()).toHaveText(
    "Studio Wireless Headphones",
  );
  expect(posts).toEqual([]);
  await page.getByLabel("Refine by text").fill("nothingmatches123");
  await page.getByRole("button", { name: "Find similar products" }).click();
  await expect(matches.getByText(/No similar photos found/)).toBeVisible();
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(
    page.getByRole("img", { name: "Selected product preview" }),
  ).toHaveCount(0);
});
