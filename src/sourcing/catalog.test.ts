import { expect, it } from "vitest";
import {
  ancestry,
  formatMinor,
  matchingOffers,
  offers,
  searchOffers,
  unitPrice,
} from "./catalog";

it("finds rural origins and supplier addresses independently", () => {
  expect(ancestry("pattamadai").map((place) => place.name)).toEqual([
    "Asia",
    "India",
    "Tamil Nadu",
    "Tirunelveli",
    "Pattamadai",
  ]);
  const mat = searchOffers(
    new URLSearchParams("q=handwoven+Tamil+Nadu&place=surat"),
  );
  expect(mat).toHaveLength(1);
  expect(mat[0].supplier.base).toBe("surat");
  expect(mat[0].product.origin).toBe("pattamadai");
});

it("prices real quantities from the applicable minor-unit tier", () => {
  const offer = offers.find((item) => item.id === "controller--board-factory")!;
  expect(unitPrice(offer, 24)).toBeUndefined();
  expect(unitPrice(offer, 25)).toBe(3600);
  expect(unitPrice(offer, 99)).toBe(3600);
  expect(unitPrice(offer, 100)).toBe(3240);
  expect(unitPrice(offer, 100.5)).toBeUndefined();
  expect(formatMinor(50000, "VND")).toContain("50,000");
});

it("honors destination, MOQ and custom capability when matching", () => {
  const base = {
    offerId: "reed-mat--reed-studio",
    destination: "IN",
    quantity: 20,
  };
  expect(matchingOffers({ ...base, custom: false })).toHaveLength(2);
  expect(matchingOffers({ ...base, custom: true })).toHaveLength(1);
  expect(matchingOffers({ ...base, destination: "CN", custom: false })).toEqual(
    [],
  );
  expect(matchingOffers({ ...base, quantity: 1, custom: false })).toHaveLength(
    1,
  );
});
