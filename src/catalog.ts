import { rankListings } from "./listing-search";
import { demoRetailProducts, legacyShopCategories } from "./demo-retail";
export type Section =
  "shop" | "nearby" | "global" | "together" | "care" | "connect" | "business";

export interface Listing {
  id: string;
  name: string;
  section: Section;
  detail: string;
  category: string;
  price?: number;
  image?: string;
  city?: string;
  coords?: [number, number];
  distance?: number;
  manufacturer?: boolean;
  market?: string;
  specifications?: Record<string, string>;
  demoStock?: number;
  shopSlug?: string;
  addedOn?: number;
  quoteOnly?: boolean;
  condition?: "New";
  subcategory?: string;
  demoVariants?: { id: string; label: string; surcharge: number; stock: number }[];
}

export const products = demoRetailProducts;

const markets: [string, string, string, string, [number, number]][] = [
  ["tiruppur", "Tiruppur", "India", "Textiles and garments", [77.34, 11.11]],
  ["surat", "Surat", "India", "Fabrics and textiles", [72.83, 21.17]],
  ["sivakasi", "Sivakasi", "India", "Printing and packaging", [77.79, 9.45]],
  ["moradabad", "Moradabad", "India", "Metal handicrafts", [78.77, 28.84]],
  ["yiwu", "Yiwu", "China", "General merchandise", [120.08, 29.31]],
  ["shenzhen", "Shenzhen", "China", "Electronics", [114.06, 22.54]],
  [
    "guangzhou",
    "Guangzhou",
    "China",
    "Fashion and accessories",
    [113.26, 23.13],
  ],
  ["bangkok", "Bangkok", "Thailand", "Wholesale clothing", [100.5, 13.76]],
  [
    "dubai",
    "Dubai",
    "United Arab Emirates",
    "Perfumes and trading",
    [55.27, 25.2],
  ],
  ["istanbul", "Istanbul", "Türkiye", "Leather and textiles", [28.98, 41.01]],
  [
    "ho-chi-minh",
    "Ho Chi Minh City",
    "Vietnam",
    "Furniture and manufacturing",
    [106.7, 10.78],
  ],
];

const fixtures: Listing[] = [
  {
    id: "form-frequency",
    name: "Form & Frequency Studio",
    section: "nearby",
    detail: "10 am–8 pm · Pickup available",
    category: "Electronics",
    city: "Chennai",
    distance: 2,
    coords: [80.24, 13.06],
  },
  {
    id: "clay-kiln",
    name: "Clay & Kiln Workshop",
    section: "nearby",
    detail: "11 am–7 pm · Pickup available",
    category: "Home & Living",
    city: "Chennai",
    distance: 5,
    coords: [80.26, 13.09],
  },
  {
    id: "loom",
    name: "The Loom Supply Co.",
    section: "nearby",
    detail: "9 am–6 pm · Wholesale pickup",
    category: "Fashion",
    city: "Coimbatore",
    distance: 3,
    coords: [76.97, 11.02],
  },
  {
    id: "weft-works",
    name: "Weft Works Manufacturing",
    section: "global",
    detail: "India",
    category: "Textiles and garments",
    city: "Tiruppur",
    market: "tiruppur",
    manufacturer: true,
  },
  {
    id: "form-assembly",
    name: "Form Assembly Studio",
    section: "global",
    detail: "China",
    category: "Electronics",
    city: "Shenzhen",
    market: "shenzhen",
    manufacturer: true,
  },
  {
    id: "cup-club",
    name: "Stoneware Cup Collective",
    section: "together",
    detail: "Chennai pickup · Clay & Kiln",
    category: "Home & Living",
    price: 1299,
    image: "cups",
    city: "Chennai",
  },
  {
    id: "tote-club",
    name: "Canvas Tote Group Buy",
    section: "together",
    detail: "Coimbatore pickup · Thread & Loom",
    category: "Fashion",
    price: 899,
    image: "tote",
    city: "Coimbatore",
  },
  {
    id: "appliance",
    name: "Appliance Repair",
    section: "care",
    detail: "HomeFix Chennai · 30-day sample labour warranty",
    category: "Appliances",
    price: 499,
  },
  {
    id: "audio",
    name: "Headphone & Electronics Repair",
    section: "care",
    detail: "Circuit Works · Parts quoted separately",
    category: "Electronics",
    price: 399,
  },
  {
    id: "mobile",
    name: "Mobile & Computer Repair",
    section: "care",
    detail: "Circuit Works · 30-day sample labour warranty",
    category: "Computers",
    price: 599,
  },
  {
    id: "electrical",
    name: "Electrical Services",
    section: "care",
    detail: "HomeFix Chennai · Labour estimate",
    category: "Home Maintenance",
    price: 399,
  },
  {
    id: "plumbing",
    name: "Plumbing & Home Maintenance",
    section: "care",
    detail: "HomeFix Chennai · Labour estimate",
    category: "Home Maintenance",
    price: 349,
  },
  {
    id: "vehicle",
    name: "Vehicle Service Inspection",
    section: "care",
    detail: "City Motor Works · Labour estimate",
    category: "Vehicles",
    price: 799,
  },
];

export const listings: Listing[] = [
  ...products,
  ...fixtures,
  ...markets.map(([id, name, detail, category, coords]): Listing => ({
    id,
    name,
    detail,
    category,
    coords,
    section: "global",
  })),
];

export function findListings(
  query = "",
  section?: Section,
  category?: string,
  city?: string,
  includeAlertSample = false,
) {
  const lamp = listings.find((item) => item.id === "globe-lamp" && item.section === "shop");
  const catalogue = includeAlertSample && lamp ? [...listings, {
    ...lamp, id: "demo-match-alabaster-lamp", name: "Alabaster Match Demo Lamp",
  }] : listings;
  const candidates = catalogue.filter(
    (item) =>
      (!section || item.section === section) &&
      (!category || item.category === category || (item.section === "shop" && legacyShopCategories[category]?.includes(item.category))) &&
      (!city || item.city === city),
  );
  return rankListings(candidates, query);
}

export const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export const asset = (path: string) => import.meta.env.BASE_URL + path;
export const groupTarget = 20;
export const groupSeed = 12;
export function groupPrice(retail: number, units: number) {
  return units >= groupTarget ? Math.round(retail * 0.8) : retail;
}

export function wholesalePrice(quantity: number) {
  return quantity >= 250 ? 310 : quantity >= 100 ? 350 : 420;
}

export interface CatalogRepository {
  search(query: string, includeAlertSample?: boolean): Promise<Listing[]>;
}

export const demoCatalog: CatalogRepository = {
  async search(query, includeAlertSample) {
    return findListings(query, undefined, undefined, undefined, includeAlertSample);
  },
};
