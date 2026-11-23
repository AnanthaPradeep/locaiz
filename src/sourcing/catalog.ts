export const roles = [
  "Artisan",
  "Home-based producer",
  "Cottage industry",
  "Workshop",
  "Small manufacturer",
  "Medium manufacturer",
  "Large manufacturer",
  "Wholesaler",
  "Distributor",
  "Retailer",
  "Exporter",
  "Service provider",
] as const;
export type Role = (typeof roles)[number];
export type Place = {
  id: string;
  name: string;
  parent?: string;
  kind: string;
  country?: string;
  coords?: [number, number];
};
export const places: Place[] = [
  { id: "asia", name: "Asia", kind: "Continent" },
  { id: "in", name: "India", parent: "asia", kind: "Country", country: "IN" },
  { id: "tn", name: "Tamil Nadu", parent: "in", kind: "State" },
  { id: "tirunelveli", name: "Tirunelveli", parent: "tn", kind: "District" },
  {
    id: "pattamadai",
    name: "Pattamadai",
    parent: "tirunelveli",
    kind: "Town",
    coords: [77.59, 8.67],
  },
  {
    id: "tiruppur",
    name: "Tiruppur",
    parent: "tn",
    kind: "City",
    coords: [77.34, 11.11],
  },
  {
    id: "chennai",
    name: "Chennai",
    parent: "tn",
    kind: "City",
    coords: [80.27, 13.08],
  },
  { id: "gj", name: "Gujarat", parent: "in", kind: "State" },
  {
    id: "surat",
    name: "Surat",
    parent: "gj",
    kind: "City",
    coords: [72.83, 21.17],
  },
  { id: "up", name: "Uttar Pradesh", parent: "in", kind: "State" },
  { id: "odisha", name: "Odisha", parent: "in", kind: "State" },
  {
    id: "raghurajpur",
    name: "Raghurajpur",
    parent: "odisha",
    kind: "Village",
    coords: [85.83, 19.88],
  },
  {
    id: "moradabad",
    name: "Moradabad",
    parent: "up",
    kind: "City",
    coords: [78.77, 28.84],
  },
  { id: "cn", name: "China", parent: "asia", kind: "Country", country: "CN" },
  { id: "zhejiang", name: "Zhejiang", parent: "cn", kind: "Province" },
  {
    id: "yiwu",
    name: "Yiwu",
    parent: "zhejiang",
    kind: "City",
    coords: [120.08, 29.31],
  },
  { id: "guangdong", name: "Guangdong", parent: "cn", kind: "Province" },
  {
    id: "shenzhen",
    name: "Shenzhen",
    parent: "guangdong",
    kind: "City",
    coords: [114.06, 22.54],
  },
  {
    id: "guangzhou",
    name: "Guangzhou",
    parent: "guangdong",
    kind: "City",
    coords: [113.26, 23.13],
  },
  {
    id: "th",
    name: "Thailand",
    parent: "asia",
    kind: "Country",
    country: "TH",
  },
  {
    id: "bangkok",
    name: "Bangkok",
    parent: "th",
    kind: "City",
    coords: [100.5, 13.76],
  },
  { id: "tr", name: "Türkiye", kind: "Country", country: "TR" },
  {
    id: "istanbul",
    name: "Istanbul",
    parent: "tr",
    kind: "City",
    coords: [28.98, 41.01],
  },
  { id: "vn", name: "Vietnam", parent: "asia", kind: "Country", country: "VN" },
  { id: "hcm", name: "Ho Chi Minh City", parent: "vn", kind: "Municipality" },
  {
    id: "binh-duong",
    name: "Binh Duong area",
    parent: "hcm",
    kind: "Production region",
    coords: [106.65, 10.98],
  },
];
export function ancestry(id: string): Place[] {
  const place = places.find((item) => item.id === id);
  return place ? [...(place.parent ? ancestry(place.parent) : []), place] : [];
}
export const placeName = (id: string) =>
  places.find((place) => place.id === id)?.name ?? id;

export const categories: Record<string, string[]> = {
  "Handmade and regional": [
    "Handwoven mats",
    "Pottery",
    "Metal crafts",
    "Wood crafts",
    "Paintings",
  ],
  "Consumer commerce": ["Garments", "Furniture", "Accessories", "Electronics"],
  "Wholesale and industrial": [
    "Electronic components",
    "Mechanical parts",
    "Industrial machinery",
  ],
};
export interface Product {
  id: string;
  name: string;
  category: string;
  origin: string;
  variant: string;
  method: string;
  specs: Record<string, string>;
  legacyId?: string;
}
export const products: Product[] = [
  {
    id: "reed-mat",
    name: "Handwoven reed mat",
    category: "Handwoven mats",
    origin: "pattamadai",
    variant: "Standard",
    method: "Hand weaving",
    specs: { Material: "Reed", Dimensions: "90 × 180 cm" },
  },
  {
    id: "clay-cups",
    name: "Hand-thrown clay cups",
    category: "Pottery",
    origin: "pattamadai",
    variant: "Pair",
    method: "Wheel thrown",
    specs: { Material: "Clay" },
  },
  {
    id: "brass-bowl",
    name: "Hand-finished brass bowl",
    category: "Metal crafts",
    origin: "moradabad",
    variant: "150 mm",
    method: "Hand finished",
    specs: { Material: "Brass" },
  },
  {
    id: "wood-tray",
    name: "Carved wooden tray",
    category: "Wood crafts",
    origin: "yiwu",
    variant: "Standard",
    method: "Hand carved",
    specs: { Material: "Wood" },
  },
  {
    id: "painted-panel",
    name: "Hand-painted cloth panel",
    category: "Paintings",
    origin: "raghurajpur",
    variant: "Small",
    method: "Hand painted",
    specs: { Material: "Cloth" },
  },
  {
    id: "cotton-tee",
    name: "Cotton crew-neck T-shirt",
    category: "Garments",
    origin: "tiruppur",
    variant: "Medium",
    method: "Cut and sew",
    specs: { Fabric: "Cotton", Weight: "180 g/m²" },
  },
  {
    id: "shelf",
    name: "Solid wood shelving",
    category: "Furniture",
    origin: "binh-duong",
    variant: "Three-tier",
    method: "Workshop assembly",
    specs: { Width: "800 mm" },
  },
  {
    id: "strap",
    name: "Leather carry strap",
    category: "Accessories",
    origin: "istanbul",
    variant: "Standard",
    method: "Stitched assembly",
    specs: { Length: "1 m" },
  },
  {
    id: "headphones",
    name: "Studio Wireless Headphones",
    category: "Electronics",
    origin: "shenzhen",
    variant: "Standard",
    method: "Factory assembly",
    specs: { Model: "STUDIO-WIRELESS" },
    legacyId: "studio-headphones",
  },
  {
    id: "controller",
    name: "Microcontroller development board",
    category: "Electronic components",
    origin: "shenzhen",
    variant: "USB-C",
    method: "Surface-mount assembly",
    specs: { Model: "MC-32", Voltage: "3.3 V I/O" },
  },
  {
    id: "coupling",
    name: "Machined shaft coupling",
    category: "Mechanical parts",
    origin: "chennai",
    variant: "20 mm bore",
    method: "CNC machining",
    specs: { Material: "Steel", Tolerance: "±0.05 mm" },
  },
  {
    id: "cnc",
    name: "Benchtop CNC milling machine",
    category: "Industrial machinery",
    origin: "chennai",
    variant: "Three-axis",
    method: "Industrial assembly",
    specs: { Model: "BM-300", Travel: "300 × 180 × 120 mm" },
  },
];

export interface Supplier {
  id: string;
  name: string;
  base: string;
  production?: string;
  roles: Role[];
  languages: string[];
}
const supplierRows: [string, string, string, string | undefined, Role[]][] = [
  [
    "reed-studio",
    "Reed Loom Studio",
    "pattamadai",
    "pattamadai",
    ["Artisan", "Cottage industry"],
  ],
  [
    "clay-studio",
    "Clay Wheel Studio",
    "pattamadai",
    "pattamadai",
    ["Artisan", "Home-based producer"],
  ],
  ["brass-studio", "Brass Bench Studio", "moradabad", "moradabad", ["Artisan"]],
  ["wood-studio", "Carved Grain Studio", "yiwu", "yiwu", ["Artisan"]],
  [
    "paint-studio",
    "Village Brush Studio",
    "raghurajpur",
    "raghurajpur",
    ["Artisan"],
  ],
  ["coupling-shop", "Axis Bench Workshop", "chennai", "chennai", ["Workshop"]],
  [
    "strap-shop",
    "Threaded Hide Workshop",
    "istanbul",
    "istanbul",
    ["Workshop"],
  ],
  [
    "shelf-shop",
    "Joinery Table Workshop",
    "binh-duong",
    "binh-duong",
    ["Workshop"],
  ],
  ["fabric-trade", "Loomline Trade", "surat", undefined, ["Wholesaler"]],
  [
    "general-trade",
    "Market Basket Trade",
    "yiwu",
    undefined,
    ["Wholesaler", "Distributor"],
  ],
  [
    "garment-trade",
    "Stitch Route Trade",
    "guangzhou",
    undefined,
    ["Wholesaler", "Exporter"],
  ],
  ["bangkok-trade", "Cloth Route Trade", "bangkok", undefined, ["Wholesaler"]],
  [
    "board-factory",
    "Circuit Assembly Works",
    "shenzhen",
    "shenzhen",
    ["Large manufacturer", "Exporter"],
  ],
  [
    "cotton-factory",
    "Knit Assembly Works",
    "tiruppur",
    "tiruppur",
    ["Small manufacturer"],
  ],
  [
    "machine-factory",
    "Bench Mill Works",
    "chennai",
    "chennai",
    ["Medium manufacturer"],
  ],
  ["audio-retail", "Audio Counter", "chennai", undefined, ["Retailer"]],
];
export const suppliers: Supplier[] = supplierRows.map(
  ([id, name, base, production, roles]) => ({
    id,
    name,
    base,
    production,
    roles,
    languages: ["English"],
  }),
);

export const methods = [
  "Local retail",
  "Online retail",
  "Wholesale",
  "Maker-direct",
  "Custom manufacturing",
  "Sample order",
  "Community purchase",
  "Quote only",
] as const;
export type Method = (typeof methods)[number];
export interface Offer {
  id: string;
  productId: string;
  supplierId: string;
  method: Method;
  currency: string;
  moq: number;
  tiers: { quantity: number; minor: number }[];
  shipping: string[];
  stock?: string;
  pickup?: string;
  shipFrom?: string;
  custom?: boolean;
  leadDays: number;
}
const rows: [
  string,
  string,
  Method,
  string,
  number,
  number | null,
  string?,
  boolean?,
][] = [
  [
    "reed-mat",
    "reed-studio",
    "Maker-direct",
    "INR",
    1,
    140000,
    "pattamadai",
    true,
  ],
  ["reed-mat", "fabric-trade", "Wholesale", "INR", 20, 112000, "surat"],
  [
    "clay-cups",
    "clay-studio",
    "Maker-direct",
    "INR",
    1,
    85000,
    "pattamadai",
    true,
  ],
  ["brass-bowl", "brass-studio", "Maker-direct", "INR", 1, 99000, "moradabad"],
  ["wood-tray", "wood-studio", "Maker-direct", "CNY", 1, 8600, "yiwu", true],
  [
    "painted-panel",
    "paint-studio",
    "Maker-direct",
    "INR",
    1,
    120000,
    "raghurajpur",
    true,
  ],
  ["wood-tray", "general-trade", "Wholesale", "CNY", 50, 6200, "yiwu"],
  [
    "cotton-tee",
    "cotton-factory",
    "Wholesale",
    "INR",
    25,
    34000,
    "tiruppur",
    true,
  ],
  ["cotton-tee", "garment-trade", "Wholesale", "CNY", 100, 2800, "guangzhou"],
  ["cotton-tee", "bangkok-trade", "Wholesale", "THB", 50, 13500, "bangkok"],
  [
    "shelf",
    "shelf-shop",
    "Custom manufacturing",
    "VND",
    5,
    null,
    undefined,
    true,
  ],
  ["strap", "strap-shop", "Sample order", "TRY", 1, 19000, "istanbul"],
  ["controller", "board-factory", "Wholesale", "CNY", 25, 3600, "shenzhen"],
  ["headphones", "audio-retail", "Local retail", "INR", 1, 499900, "chennai"],
  ["headphones", "board-factory", "Wholesale", "CNY", 20, 24500, "shenzhen"],
  [
    "coupling",
    "coupling-shop",
    "Custom manufacturing",
    "INR",
    10,
    null,
    undefined,
    true,
  ],
  ["cnc", "machine-factory", "Quote only", "INR", 1, null, undefined, true],
];
export const offers: Offer[] = rows.map(
  ([productId, supplierId, method, currency, moq, minor, pickup, custom]) => {
    const supplier = suppliers.find((item) => item.id === supplierId)!;
    const country = ancestry(supplier.base).find(
      (place) => place.country,
    )?.country;
    return {
      id: `${productId}--${supplierId}`,
      productId,
      supplierId,
      method,
      currency,
      moq,
      tiers:
        minor === null
          ? []
          : [
              { quantity: moq, minor },
              ...(method === "Wholesale"
                ? [{ quantity: moq * 4, minor: Math.round(minor * 0.9) }]
                : []),
            ],
      shipping: country ? [country] : [],
      pickup,
      stock:
        method === "Local retail" || method === "Wholesale"
          ? pickup
          : undefined,
      shipFrom: supplier.base,
      custom,
      leadDays: custom ? 14 : 7,
    };
  },
);

export function unitPrice(offer: Offer, quantity: number) {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < offer.moq ||
    quantity > 1000000
  )
    return undefined;
  return offer.tiers.filter((tier) => tier.quantity <= quantity).at(-1)?.minor;
}

export interface SourcingRequest {
  offerId: string;
  quantity: number;
  destination: string;
  custom: boolean;
}

export function matchingOffers(request: SourcingRequest) {
  const target = offers.find((offer) => offer.id === request.offerId);
  if (!target) return [];
  return offers.filter(
    (offer) =>
      offer.productId === target.productId &&
      offer.moq <= request.quantity &&
      offer.shipping.includes(request.destination) &&
      (!request.custom || offer.custom),
  );
}

export function formatMinor(amount: number, currency: string) {
  const display = new Intl.NumberFormat("en", { style: "currency", currency });
  return display.format(
    amount / 10 ** (display.resolvedOptions().maximumFractionDigits ?? 2),
  );
}

export function searchOffers(params: URLSearchParams) {
  const q = (params.get("q") ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const category = params.get("category") ?? "";
  return offers.flatMap((offer) => {
    const product = products.find((item) => item.id === offer.productId)!;
    const supplier = suppliers.find((item) => item.id === offer.supplierId)!;
    const locality = [...ancestry(supplier.base), ...ancestry(product.origin)];
    const label = [
      product.name,
      product.category,
      supplier.name,
      product.method,
      ...supplier.roles,
      ...locality.map((place) => place.name),
    ]
      .join(" ")
      .toLowerCase();
    return q.every((word) => label.includes(word)) &&
      (!params.get("place") ||
        locality.some((place) => place.id === params.get("place"))) &&
      (!category ||
        category === product.category ||
        (Object.hasOwn(categories, category) &&
          categories[category].includes(product.category))) &&
      (!params.get("role") ||
        supplier.roles.some((role) => role === params.get("role"))) &&
      (!params.get("method") || params.get("method") === offer.method) &&
      (!params.get("destination") ||
        offer.shipping.includes(params.get("destination")!)) &&
      (!params.has("pickup") || offer.pickup) &&
      (!params.has("custom") || offer.custom) &&
      (!params.get("maxMoq") || offer.moq <= Number(params.get("maxMoq")))
      ? [{ offer, product, supplier }]
      : [];
  });
}
