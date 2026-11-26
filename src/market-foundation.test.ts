import { expect, it } from "vitest";
import { parsePriceTiers, validateUpload, verifyFileHeader } from "./market-foundation";
it("keeps tier amounts in integer minor units", () => {
  expect(parsePriceTiers("10:5500\n50:5000")).toEqual([
    { quantity: 10, minor: 5500 },
    { quantity: 50, minor: 5000 },
  ]);
  expect(() => parsePriceTiers("5:1.50")).toThrow();
  expect(() => parsePriceTiers("0:10")).toThrow();
});
it("rejects unsupported, oversized and empty marketplace files", () => {
  expect(
    validateUpload(new File(["data"], "photo.webp", { type: "image/webp" })),
  ).toBe("webp");
  expect(() =>
    validateUpload(new File(["data"], "script.svg", { type: "image/svg+xml" })),
  ).toThrow();
  expect(() =>
    validateUpload(
      new File([new Uint8Array(5242881)], "huge.png", { type: "image/png" }),
    ),
  ).toThrow();
  expect(() =>
    validateUpload(new File([], "empty.png", { type: "image/png" })),
  ).toThrow();
  expect(
    validateUpload(
      new File(["PDF"], "evidence.pdf", { type: "application/pdf" }),
      true,
    ),
  ).toBe("pdf");
});

it("rejects a mislabeled RFQ attachment and accepts matching content", async () => {
  const fake = new File(["plain text"], "receipt.pdf", { type: "application/pdf" });
  await expect(verifyFileHeader(fake, validateUpload(fake, true))).rejects.toThrow("file content");
  const pdf = new File(["%PDF-1.7"], "receipt.pdf", { type: "application/pdf" });
  await expect(verifyFileHeader(pdf, validateUpload(pdf, true))).resolves.toBeUndefined();
});
