import { legacyShopCategories } from "./demo-retail";
import type { Listing } from "./catalog";
import {
  productSourcing,
  retailSubcategory,
  retailVariants,
  togetherListing,
} from "./product-commerce";
import { ancestry, suppliers, placeName } from "./sourcing/catalog";

function productFacets(item: Listing, activeDeal: boolean) {
  if (item.section !== "shop") return {};
  const { product: source, offers: matching } = productSourcing(item.id);
  const subcategory = retailSubcategory(item.id) ?? item.subcategory;
  return {
    brand: [item.detail],
    material: item.specifications?.Material
      ? [item.specifications.Material]
      : [],
    feature: item.specifications?.Feature ? [item.specifications.Feature] : [],
    variant: item.demoVariants?.map((variant) => variant.label) ?? [],
    category: [item.category],
    subcategory: subcategory ? [subcategory] : [],
    countryOfSupplier: matching.flatMap((offer) => {
      const supplier = suppliers.find((entry) => entry.id === offer.supplierId);
      return supplier
        ? ancestry(supplier.base)
            .filter((place) => place.country)
            .map((place) => place.name)
        : [];
    }),
    supplierCity: matching.flatMap((offer) => {
      const supplier = suppliers.find((entry) => entry.id === offer.supplierId);
      return supplier ? [placeName(supplier.base)] : [];
    }),
    origin: source ? ancestry(source.origin).map((place) => place.name) : [],
    supplierType: matching.flatMap(
      (offer) =>
        suppliers.find((supplier) => supplier.id === offer.supplierId)?.roles ??
        [],
    ),
    method: [
      item.quoteOnly ? "Quote only" : "Retail",
      ...matching.map((offer) => offer.method),
    ],
    pickup: matching.flatMap((offer) =>
      offer.pickup ? [placeName(offer.pickup)] : [],
    ),
    available: [
      item.quoteOnly
        ? "Quote only"
        : retailVariants(item).some((variant) => variant.stock > 0)
          ? "In demo stock"
          : "Out of demo stock",
    ],
    community:
      activeDeal && togetherListing(item.id, "standard")
        ? ["Deal available"]
        : [],
  };
}

export function nonnegative(value: string | null) {
  if (value === null || !/^\d+(\.\d+)?$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function catalogueFilters(
  items: Listing[],
  params: URLSearchParams,
  activeDeal: boolean,
  productListing = true,
) {
  const chosenCategories = params.getAll("category");
  const country = params.get("country") ?? "";
  const distance = params.get("distance") ?? "";
  const maximumPrice = nonnegative(params.get("maxPrice"));
  const minimumPrice = nonnegative(params.get("minPrice"));
  const maxMoq = nonnegative(params.get("maxMoq"));
  const facetKeys = [
    "category",
    "material",
    "feature",
    "variant",
    "subcategory",
    "brand",
    "origin",
    "countryOfSupplier",
    "supplierCity",
    "supplierType",
    "method",
    "pickup",
    "available",
    "community",
  ] as const;
  const rows = items.map((item) => ({
    item,
    facets: productFacets(item, activeDeal),
  }));
  const optionValues = (key: (typeof facetKeys)[number]) =>
    [
      ...new Set(
        rows.flatMap(({ item, facets }) =>
          ["material", "feature", "variant", "subcategory"].includes(key) &&
          chosenCategories.length &&
          !chosenCategories.some(
            (category) =>
              item.category === category ||
              (Object.hasOwn(legacyShopCategories, category) &&
                legacyShopCategories[category].includes(item.category)),
          )
            ? []
            : (facets[key] ?? []),
        ),
      ),
    ].sort();
  const activeFacets = facetKeys
    .filter((key) => key !== "category")
    .flatMap((key) => {
      const values = params.getAll(key);
      return values.length ? [{ key, values }] : [];
    });
  const offerFacetKeys = [
    "countryOfSupplier",
    "supplierCity",
    "supplierType",
    "method",
    "pickup",
  ];
  const activeOfferFacets = activeFacets.filter(({ key }) =>
    offerFacetKeys.includes(key),
  );
  const matchesOffer = (item: Listing) => {
    if (!activeOfferFacets.length && maxMoq === undefined) return true;
    if (item.section !== "shop") return false;
    if (
      (maxMoq === undefined || maxMoq >= 1) &&
      activeOfferFacets.every(
        ({ key, values }) =>
          key === "method" &&
          values.includes(item.quoteOnly ? "Quote only" : "Retail"),
      )
    )
      return true;
    return productSourcing(item.id).offers.some((offer) => {
      if (maxMoq !== undefined && offer.moq > maxMoq) return false;
      const supplier = suppliers.find((entry) => entry.id === offer.supplierId);
      const attributes: Record<string, readonly string[]> = {
        countryOfSupplier: supplier
          ? ancestry(supplier.base)
              .filter((place) => place.country)
              .map((place) => place.name)
          : [],
        supplierCity: supplier ? [placeName(supplier.base)] : [],
        supplierType: supplier?.roles ?? [],
        method: [offer.method],
        pickup: offer.pickup ? [placeName(offer.pickup)] : [],
      };
      return activeOfferFacets.every(({ key, values }) =>
        values.some((value) => attributes[key].includes(value)),
      );
    });
  };
  const filtered = rows
    .filter(
      ({ item, facets }) =>
        (!chosenCategories.length ||
          chosenCategories.some(
            (value) =>
              item.category === value ||
              (item.section === "shop" &&
                Object.hasOwn(legacyShopCategories, value) &&
                legacyShopCategories[value].includes(item.category)),
          )) &&
        (!country || country === item.detail) &&
        (!distance || (item.distance ?? Infinity) <= Number(distance)) &&
        (!productListing ||
          ((maximumPrice === undefined ||
            (item.price !== undefined && item.price <= maximumPrice)) &&
            (minimumPrice === undefined ||
              (item.price !== undefined && item.price >= minimumPrice)) &&
            activeFacets.every(({ key, values }) =>
              facets[key]?.some((option) => values.includes(option)),
            ) &&
            matchesOffer(item))),
    )
    .map(({ item }) => item);
  return {
    filtered,
    optionValues,
    activeFacets,
    facetKeys,
    maximumPrice,
    minimumPrice,
    maxMoq,
  };
}
