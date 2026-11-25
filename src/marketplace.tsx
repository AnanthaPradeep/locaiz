import { marketClient } from "./market-foundation";
import { ConnectedResults, PublishedProduct } from "./market-public";
import { FindBuyingOptions, PdpBuyingOptions } from "./find-it";
import { parseIntent } from "./buyer-intent";
import { shopCategories } from "./demo-retail";
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useMatch, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import {
  demoCatalog,
  findListings,
  asset,
  groupPrice,
  groupSeed,
  groupTarget,
  money,
  products,
  wholesalePrice,
  type Listing,
  type Section,
} from "./catalog";
import { ListingCard } from "./listing-card";
import { modules } from "./shell";
import { useDemo } from "./store";
import { Business, RequirementForm } from "./workspace";
import { Missing, Page } from "./page";
import { stockEnabled, stockPath } from "./stock/config";
import { productSourcing, retailVariants, togetherListing } from "./product-commerce";
import { suppliers, placeName, formatMinor } from "./sourcing/catalog";

import { catalogueFilters, nonnegative } from "./catalogue-filters";
import { SavedSearchButton } from "./saved-search-ui";

const MarketMap = lazy(() => import("./market-map"));

const filterFields = {
  brand: "Brand",
  material: "Material / construction",
  feature: "Product attributes",
  variant: "Variant",
  category: "Category",
  subcategory: "Subcategory",
  countryOfSupplier: "Supplier country",
  supplierCity: "Supplier city",
  minPrice: "Minimum price (₹)",
  origin: "Production origin",
  supplierType: "Supplier type",
  method: "Purchase method",
  maxMoq: "Maximum MOQ",
  pickup: "Pickup location",
  available: "Availability",
  community: "Community buying",
} as const;

const descriptions: Record<Section, string> = {
  shop: "Explore independent brands, everyday essentials and considered design.",
  nearby: "Find sample retail and wholesale shops with local pickup.",
  global: "Explore real sourcing cities and sample wholesale offers.",
  together: "Pool orders to reach a quantity target and unlock group pricing.",
  care: "Find a sample professional or compare repair and replacement costs.",
  connect: "Post a buyer requirement and compare sample quotations.",
  business:
    "Manage a sample retail, wholesale, manufacturing or service business.",
};

export default function Marketplace() {
  const { section, id } = useParams();
  const [params, setParams] = useSearchParams();
  const [map, setMap] = useState(false);
  const city = useDemo((state) => state.city);
  const includeAlertSample = useDemo((state) => state.includeAlertSample);
  const dealOpen = useDemo((state) => state.groupDeadline) > Date.now();
  const active = modules.find((module) => module.id === section);
  const search = Boolean(useMatch("/search"));
  const term = params.get("q") ?? "";
  const query = useQuery({
    queryKey: ["catalog", term, includeAlertSample],
    queryFn: () => demoCatalog.search(term, includeAlertSample),
    enabled: search,
  });
  const setOption = (name: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(name, value);
      else next.delete(name);
      if (name !== "page" && name !== "view") next.delete("page");
      return next;
    });
  if (id) {
    if (marketClient && section === "shop" && id.startsWith("market-")) return <PublishedProduct id={id} />;
    const item = findListings("", active?.id as Section, undefined, undefined, includeAlertSample).find(
      (entry) => entry.id === id && entry.section === section,
    );
    return item ? <ListingDetail key={item.id} item={item} /> : <Missing />;
  }
  if (!search && !active) return <Missing />;
  if (section === "connect")
    return (
      <Page
        title="Post your requirement"
        label="LOCAIZ CONNECT"
        intro={descriptions.connect}
      >
        {marketClient && <Link className="button" to="/account/journey?new=1">Send a live RFQ</Link>}
        <RequirementForm key={params.toString()} />
      </Page>
    );
  if (search && params.get("find") === "1") return <Page title="Find It Your Way" label="LOCAIZ MARKETPLACE" intro="Compare ways to buy or source your product. Demo catalogue."><FindBuyingOptions params={params} /></Page>;
  if (section === "business") return <Business panel="dashboard" />;
  const items = search
    ? (query.data ?? [])
    : findListings(section === "shop" ? term : "", section as Section,
        "",
        section === "nearby" ? city : "",
        includeAlertSample, true,
      );
  const category = params.get("category") ?? "";
  const chosenCategories = params.getAll("category");
  const country = params.get("country") ?? "";
  const distance = params.get("distance") ?? "";
  const sort = params.get("sort") ?? "";
  const productListing = search || section === "shop";
  const listView = productListing && params.get("view") === "list";
  const clearable = ["category", "maxPrice", ...Object.keys(filterFields)];
  const { filtered, optionValues, activeFacets, facetKeys, maximumPrice, minimumPrice, maxMoq } = catalogueFilters(items, params, dealOpen, productListing);
  function toggleFacet(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (next.getAll(key).includes(value)) next.delete(key, value);
    else next.append(key, value);
    next.delete("page");
    setParams(next);
  }
  const appliedCount = chosenCategories.length + activeFacets.reduce((sum, facet) => sum + facet.values.length, 0) + [minimumPrice, maximumPrice, maxMoq].filter((value) => value !== undefined).length;
  if (sort)
    filtered.sort((a, b) => {
      if (sort === "newest") return (b.addedOn ?? 0) - (a.addedOn ?? 0);
      if (sort !== "price" && sort !== "price-desc")
        return a.name.localeCompare(b.name);
      if (a.price === undefined) return b.price === undefined ? 0 : 1;
      if (b.price === undefined) return -1;
      return sort === "price" ? a.price - b.price : b.price - a.price;
    });
  const advancedFields = productListing && (<>
                  {(["minPrice", "maxMoq"] as const).map((key) => (
                    <label key={key}>{filterFields[key]}
                      <input type="number" min="0" value={nonnegative(params.get(key)) ?? ""} onChange={(event) => setOption(key, event.target.value)} />
                    </label>
                  ))}
                  {facetKeys.map((key) => {
                    const values = optionValues(key);
                    return values.length > 0 && (
                      <fieldset className="catalogue-facet" key={key}><legend>{filterFields[key]}</legend>
                        {values.map((value) => (
                          <label key={value}>
                            <input type="checkbox" checked={params.getAll(key).includes(value)} onChange={() => toggleFacet(key, value)} />
                            {value}
                          </label>
                        ))}
                      </fieldset>
                    );
                  })}
  </>);
  const canMap = section === "nearby" || section === "global";
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const requestedPage = Number(params.get("page"));
  const page = Number.isInteger(requestedPage)
    ? Math.min(pageCount, Math.max(1, requestedPage))
    : 1;
  const visibleItems = productListing
    ? filtered.slice((page - 1) * pageSize, page * pageSize)
    : filtered;
  return (
    <Page
      title={
        search
          ? term
            ? `Results for “${term}”`
            : "Search the marketplace"
          : active!.title
      }
      label={search ? "UNIVERSAL SEARCH" : "LOCAIZ MARKETPLACE"}
      intro={
        search
          ? "Products, businesses, sourcing markets and services."
          : descriptions[section as Section]
      }
    >
      {section === "shop" && <><nav aria-label="Breadcrumb" className="actions"><Link to="/">Home</Link><span aria-current="page">Shop</span></nav><p className="muted">Demo catalogue · Illustrative prices, inventory and product photos.</p><nav className="actions catalogue-categories" aria-label="Shop departments">{shopCategories.map((value) => <button key={value} type="button" className="outline" aria-pressed={chosenCategories.includes(value)} onClick={() => toggleFacet("category", value)}>{value}</button>)}</nav></>}
      {section === "shop" && <label className="catalogue-search">Search products<input type="search" placeholder="Search by product name" value={term} onChange={(event) => setOption("q", event.target.value)} /></label>}
      {search && <Link className="outline" to={"/search?" + new URLSearchParams([...params, ["find", "1"]])}>Explore buying options</Link>}
      {productListing && <SavedSearchButton scope={search ? "search" : "shop"} params={params} />}
      <div className={section === "shop" ? "filterbar catalogue-toolbar" : "filterbar"}>
        {(section === "global" ||
          section === "shop" ||
          section === "nearby" ||
          section === "care" ||
          section === "together" ||
          search) && (
          <Link
            className="outline"
            to={
              section === "care"
                ? "/sourcing?category=Mechanical+parts"
                : section === "nearby"
                  ? "/sourcing?pickup=1"
                  : search
                    ? `/sourcing?${new URLSearchParams({ q: term })}`
                    : "/sourcing"
            }
          >
            {section === "care"
              ? "Source replacement parts"
              : "Village-to-Global directory"}
          </Link>
        )}
        <label>
          Category
          <select
            value={category}
            onChange={(event) => setOption("category", event.target.value)}
          >
            <option value="">All categories</option>
            {[...new Set(items.map((item) => item.category))]
              .sort()
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
        </label>
        {section === "global" && (
          <label>
            Country
            <select
              value={country}
              onChange={(event) => setOption("country", event.target.value)}
            >
              <option value="">All countries</option>
              {[...new Set(items.map((item) => item.detail))]
                .sort()
                .map((value) => (
                  <option key={value}>{value}</option>
                ))}
            </select>
          </label>
        )}
        {section === "nearby" && (
          <Link
            className="button"
            to={
              stockEnabled ? stockPath("studio-headphones") : "/account/stock"
            }
          >
            {stockEnabled ? "Check Nearby Stock" : "Stock checks · Demo Mode"}
          </Link>
        )}
        {section === "nearby" && (
          <label>
            Distance from city centre
            <select
              value={distance}
              onChange={(event) => setOption("distance", event.target.value)}
            >
              <option value="">Any distance</option>
              <option value="3">Within 3 km</option>
              <option value="5">Within 5 km</option>
            </select>
          </label>
        )}
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => setOption("sort", event.target.value)}
          >
            <option value="">Featured</option>
            <option value="name">Name</option>
            {productListing && <option value="newest">Newest</option>}
            <option value="price">Price, low to high</option>
            {productListing && <option value="price-desc">Price, high to low</option>}
          </select>
        </label>
        {productListing && (
          <>
            <label>
              Maximum price (₹)
              <input
                type="number"
                min="0"
                value={maximumPrice ?? ""}
                onChange={(event) => setOption("maxPrice", event.target.value)}
              />
            </label>
            <button
              className="outline"
              aria-label="List view"
              aria-pressed={listView}
              onClick={() => setOption("view", listView ? "" : "list")}
            >
              {listView ? "Switch to grid" : "Switch to list"}
            </button>
            <Dialog.Root>
              <Dialog.Trigger className="outline" aria-label="More product filters">Filters{appliedCount > 0 && <span className="catalogue-filter-count">{appliedCount}</span>}</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="overlay" />
                <Dialog.Content className="dialog detail-actions commerce-filter-dialog">
                  <Dialog.Title>Product filters</Dialog.Title>
                  <Dialog.Description>Combine filters to narrow your results.</Dialog.Description>
                  {advancedFields}
                  <Dialog.Close className="button">Show results</Dialog.Close>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            {clearable.some((key) => params.has(key)) && (
              <button
                className="outline"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  clearable.forEach((key) => next.delete(key));
                  next.delete("page");
                  setParams(next);
                }}
              >
                Clear filters
              </button>
            )}
          </>
        )}
        {canMap && (
          <button
            className="outline"
            aria-pressed={map}
            onClick={() => setMap(!map)}
          >
            {map ? "List view" : "Map view"}
          </button>
        )}
        {section === "shop" && (
          <Link className="outline" to="/account/compare">
            Compare products
          </Link>
        )}
        {section === "care" && (
          <Link className="outline" to="/account/repair-assistant">
            Repair or replace
          </Link>
        )}
        {section === "together" && (
          <Link className="outline" to="/account/groups">
            Manage group purchases
          </Link>
        )}
      </div>
      {productListing && (
        <div className="actions" aria-label="Active product filters">
          {chosenCategories.map((value) => <button key={value} className="outline" onClick={() => toggleFacet("category", value)} aria-label={`Remove ${value} category`}>{value} ×</button>)}
          {(["minPrice", "maxPrice", "maxMoq"] as const).map((key) => {
            const value = nonnegative(params.get(key));
            return value !== undefined && <button key={key} className="outline" onClick={() => setOption(key, "")}>{key === "maxPrice" ? "Maximum price (₹)" : filterFields[key]} {value} ×</button>;
          })}
          {activeFacets.flatMap(({ key, values }) => values.map((value) => (
            <button key={`${key}:${value}`} className="outline" onClick={() => toggleFacet(key, value)} aria-label={`Remove ${filterFields[key]} filter`}>{value} ×</button>
          )))}
        </div>
      )}
      {query.isLoading && <p role="status">Searching…</p>}
      {query.isError && (
        <button className="outline" onClick={() => void query.refetch()}>
          Retry search
        </button>
      )}
      {map && canMap && filtered.length > 0 && (
        <Suspense fallback={<p>Loading map…</p>}>
          <MarketMap items={filtered} />
        </Suspense>
      )}
      {marketClient && productListing && <ConnectedResults params={params} />}
      <p className="muted">
        {filtered.length} {filtered.length === 1 ? "result" : "results"}
        {section === "nearby" ? ` in ${city}` : ""}
      </p>
      {filtered.length === 0 && !query.isLoading && (
        <section className="record" aria-label="Search recovery">
          <p>No listings match these filters.</p>
          <div className="actions">
            {productListing && clearable.some(key => params.has(key)) && (
              <button className="outline" onClick={() => {
                const next = new URLSearchParams(params);
                clearable.forEach(key => next.delete(key));
                next.delete("page");
                setParams(next);
              }}>Remove refinements</button>
            )}
            {productListing && term.trim() && <Link className="outline" to={"/search?" + new URLSearchParams({find:"1",q:term})}>Find more buying options</Link>}
            {productListing && <Link className="outline" to="/shop">Browse all products</Link>}
          </div>
        </section>
      )}
      {productListing && filtered.length > 0 && <p className="catalogue-range">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} {section === "shop" ? "products" : "results"}</p>}
      <div className={section === "shop" ? "catalogue-layout" : undefined}>
        {section === "shop" && (
          <aside className="catalogue-sidebar" aria-label="Catalogue filters">
            <div className="record catalogue-filter-panel">
              <h2>Filters</h2>
              <div className="catalogue-filter-options">
                {advancedFields}
              </div>
            </div>
          </aside>
        )}
        <div className="catalogue-results">
      <div className={listView ? "product-grid product-list" : "product-grid"}>
        {visibleItems.map((item) => (
          <ListingCard item={item} key={item.id} quickView={productListing} />
        ))}
      </div>
      {productListing && pageCount > 1 && (
        <nav aria-label="Product pages" className="actions commerce-pagination">
          <button className="outline" disabled={page === 1} onClick={() => setOption("page", page === 2 ? "" : String(page - 1))}>
            Previous
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={number === page ? "button" : "outline"} aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} onClick={() => setOption("page", number === 1 ? "" : String(number))}>{number}</button>)}
          <button className="outline" disabled={page === pageCount} onClick={() => setOption("page", String(page + 1))}>
            Next
          </button>
        </nav>
      )}
        </div>
      </div>
    </Page>
  );
}

function ListingDetail({ item }: { item: Listing }) {
  const demo = useDemo();
  const [params] = useSearchParams();
  const intent = parseIntent(params);
  const [quantity, setQuantity] = useState(intent.item === item.id ? intent.quantity ?? 1 : 1);
  const [option, setOption] = useState(intent.item === item.id ? intent.sku || "standard" : "standard");
  const [photoIndex, setPhotoIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const [message, setMessage] = useState("");
  const variants = retailVariants(item);
  const variant = variants.find((entry) => entry.id === option) ?? variants[0];
  const photo = variant.photos[photoIndex];
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const visiblePhoto = photo !== failedPhoto ? photo : undefined;
  function movePhoto(direction: number) {
    const length = variant.photos.length;
    if (length > 1) setPhotoIndex((index) => (index + direction + length) % length);
  }
  const price = item.section === "shop" ? variant.price : (item.price ?? 0);
  const cartKey = variant.cartKey;
  const remainingCartQuantity = Math.max(0, variant.stock - (demo.cart[cartKey] ?? 0));
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= remainingCartQuantity;
  const { product: sourcingProduct, offers: supplierOffers } = productSourcing(item.id, variant.id);
  const togetherId = togetherListing(item.id, variant.id);
  const isGroup = item.section === "together";
  const membership = demo.groups[item.id] ?? 0;
  const groupUnits = groupSeed + membership;
  const expired = Date.now() >= demo.groupDeadline;
  useEffect(() => {
    if (item.section === "shop") demo.visit(item.id);
  }, [item.id, item.section, demo.visit]);
  function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const slot = `${form.get("date")} · ${form.get("time")}`;
    if (
      demo.bookings.some(
        (booking) =>
          booking.title === item.name &&
          booking.detail.startsWith(slot) &&
          booking.status === "Confirmed",
      )
    ) {
      setMessage("That sample slot is already booked on this device.");
      return;
    }
    demo.add(
      "bookings",
      item.name,
      `${slot} · ${money(price)} estimated labour`,
      "Confirmed",
    );
    setMessage("Sample booking saved.");
  }
  return (
    <Page title={item.name} label={item.category} intro={item.detail}>
      <Link className="text-link" to={`/${item.section}`}>
        Back to {modules.find((module) => module.id === item.section)?.title}
      </Link>
      <div className="detail-grid">
        {visiblePhoto ? (
          <div>
            <Dialog.Root>
              <Dialog.Trigger className="commerce-gallery-trigger" aria-label="Enlarge product image"
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    movePhoto(event.key === "ArrowLeft" ? -1 : 1);
                  }
                }}
                onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
                onTouchEnd={(event) => {
                  const start = touchStart.current;
                  touchStart.current = null;
                  const end = event.changedTouches[0]?.clientX;
                  if (start !== null && end !== undefined && Math.abs(end - start) > 45)
                    movePhoto(end < start ? 1 : -1);
                }}>
              <img
              className="detail-image"
              src={asset(`images/${visiblePhoto}.webp`)}
              alt={item.name}
              onError={() => setFailedPhoto(visiblePhoto)}
              />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="overlay" />
                <Dialog.Content className="dialog commerce-gallery">
                  <Dialog.Title>{item.name}</Dialog.Title>
                  <Dialog.Description>Enlarged product image</Dialog.Description>
                  <img src={asset(`images/${visiblePhoto}.webp`)} alt={item.name} />
                  {variant.photos.length > 1 && (
                    <div className="actions">
                      <button className="outline" onClick={() => movePhoto(-1)}>Previous photo</button>
                      <button className="outline" onClick={() => movePhoto(1)}>Next photo</button>
                    </div>
                  )}
                  <Dialog.Close className="outline">Close image</Dialog.Close>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            {variant.photos.length > 1 && (
              <div className="actions">
                {variant.photos.map((image, index) => (
                  <button key={image} className="outline" onClick={() => setPhotoIndex(index)} aria-pressed={photoIndex === index}>
                    <img className="commerce-thumbnail" src={asset(`images/${image}.webp`)} alt="" loading="lazy" />
                    <span>Photo {index + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="feature">
            <span className="eyebrow">LOCAIZ DEMO</span>
            <h2>{item.category}</h2>
            <p>
              {item.section === "global"
                ? "Real city and industry context. Supplier offers use sample data."
                : "Sample provider listing."}
            </p>
          </div>
        )}
        <div className="record detail-actions">
          {item.section === "shop" && item.quoteOnly && <><h2>Request a quote</h2><Link className="button" to={`/connect?kind=Manufacturing&product=${encodeURIComponent(item.name)}`}>Request quotation</Link></>}
          {item.section === "shop" && !item.quoteOnly && (
            <>
              <h2>{money(price)}</h2>
              <label>
                Variant
                <select
                  value={variant.label}
                  onChange={(event) => {
                    setOption(variants.find((entry) => entry.label === event.target.value)!.id);
                    setPhotoIndex(0);
                    setQuantity(1);
                    setMessage("");
                  }}
                >
                  {variants.map((entry) => <option key={entry.id}>{entry.label}</option>)}
                </select>
              </label>
              <label>
                Quantity
                <input
                  min={1}
                  max={Math.max(1, remainingCartQuantity)}
                  type="number"
                  value={Number.isNaN(quantity) ? "" : quantity}
                  onChange={(event) => setQuantity(event.target.valueAsNumber)}
                />
              </label>
              <p>SKU {variant.sku} · {variant.stock ? `${variant.stock} in demo stock` : "Out of demo stock"}</p>
              <p aria-live="polite">
                {validQuantity
                  ? `Items subtotal: ${money(price * quantity)}`
                  : remainingCartQuantity === 0
                    ? "No more units of this variant can be added."
                    : `Enter a quantity from 1 to ${remainingCartQuantity}.`}
              </p>
              <div className="actions">
                <button
                  className="button"
                  disabled={!validQuantity}
                  onClick={() => {
                    demo.setCart(cartKey, (demo.cart[cartKey] ?? 0) + quantity);
                    setMessage("Added to your sample cart.");
                  }}
                >
                  Add to cart
                </button>
                <button
                  className="outline"
                  onClick={() => demo.toggleLike(item.id)}
                >
                  {demo.liked.includes(item.id)
                    ? "Remove from wishlist"
                    : "Save to wishlist"}
                </button>
              </div>
              {["studio-headphones", "audio-pads"].includes(item.id) && (
                <Link className="outline" to={stockPath(item.id, variant.label, { quantity: quantity <= 99 ? quantity : undefined, pickup: intent.pickupDate, note: intent.notes })}>
                  Check Nearby Stock{!stockEnabled ? " · Demo Mode" : ""}
                </Link>
              )}
              <Link to="/account/cart">View cart</Link>
              <p>
                Delivery estimate and pickup availability are unconfirmed.
              </p>
            </>
          )}
          {item.section === "nearby" && (
            <>
              <h2>{item.city}</h2>
              <p>
                {item.distance} km from the city centre · Stock source:
                unverified demo fixtures.
              </p>
              {stockEnabled ? (
                <Link className="button" to={stockPath("studio-headphones")}>
                  Check Nearby Stock
                </Link>
              ) : (
                <button
                  className="button"
                  onClick={() => {
                    if (
                      demo.stock.some(
                        (request) =>
                          request.title === item.name &&
                          Date.now() - Date.parse(request.date) < 86400000,
                      )
                    ) {
                      setMessage("A demo request is already active.");
                      return;
                    }
                    demo.add(
                      "stock",
                      item.name,
                      "Simulated stock confirmation",
                      "Pending",
                    );
                    setMessage("Demo stock request created.");
                  }}
                >
                  Request stock check
                </button>
              )}
              <Link to="/account/stock">View stock requests</Link>
              {item.coords && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${item.coords[1]}&mlon=${item.coords[0]}#map=16/${item.coords[1]}/${item.coords[0]}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View approximate location on OpenStreetMap
                </a>
              )}
            </>
          )}
          {item.section === "global" && (
            <>
              <h2>Sample wholesale offer</h2>
              <p>
                {item.manufacturer
                  ? `${item.name} · ${item.city} · Demo factory profile`
                  : "Regional Supply Studio · Demo supplier"}{" "}
                · MOQ 25 · Sample and private-label requests supported.
              </p>
              <label>
                Wholesale quantity
                <input
                  type="number"
                  min={25}
                  value={quantity < 25 ? 25 : quantity}
                  onChange={(event) =>
                    setQuantity(event.target.valueAsNumber || 25)
                  }
                />
              </label>
              <dl>
                <dt>Unit estimate</dt>
                <dd>{money(wholesalePrice(quantity))}</dd>
                <dt>Goods</dt>
                <dd>
                  {money(wholesalePrice(quantity) * Math.max(25, quantity))}
                </dd>
                <dt>Estimated freight</dt>
                <dd>{money(item.detail === "India" ? 1200 : 3600)}</dd>
                <dt>Duties and tax</dt>
                <dd>Pending buyer destination and classification</dd>
              </dl>
              <Link
                className="button"
                to={`/connect?market=${item.market || item.id}`}
              >
                Request a sample or quote
              </Link>
              {item.market && (
                <Link to={`/listing/global/${item.market}`}>
                  View sourcing city
                </Link>
              )}
              {findListings("", "global")
                .filter((supplier) => supplier.market === item.id)
                .map((supplier) => (
                  <Link key={supplier.id} to={`/listing/global/${supplier.id}`}>
                    View {supplier.name}
                  </Link>
                ))}
            </>
          )}
          {isGroup && (
            <>
              <h2>{money(groupPrice(price, groupUnits))} per unit</h2>
              <progress
                value={groupUnits}
                max={groupTarget}
                aria-label="Group purchase progress"
              />
              <p>
                {groupUnits}/{groupTarget} units pledged ·{" "}
                {4 + Number(membership > 0)} participants
              </p>
              <p>
                {expired
                  ? "Deal expired"
                  : `Closes ${new Date(demo.groupDeadline).toLocaleDateString("en-IN")}`}{" "}
                · {money(price - groupPrice(price, groupTarget))} target savings
                per unit · Free demo pickup
              </p>
              <label>
                Your units
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.valueAsNumber)}
                />
              </label>
              <div className="actions">
                <button
                  className="button"
                  disabled={
                    expired ||
                    !Number.isInteger(quantity) ||
                    quantity < 1 ||
                    quantity > 20
                  }
                  onClick={() => {
                    demo.join(item.id, quantity);
                    setMessage("Demo membership saved.");
                  }}
                >
                  {membership ? "Update quantity" : "Join group"}
                </button>
                {membership > 0 && (
                  <button
                    className="outline"
                    onClick={() => {
                      demo.join(item.id, 0);
                      setMessage("You left the group.");
                    }}
                  >
                    Leave group
                  </button>
                )}
              </div>
            </>
          )}
          {item.section === "care" && (
            <>
              <h2>{money(price)} estimated labour</h2>
              <p>Demo service provider · Spare parts quoted separately.</p>
              <form onSubmit={book}>
                <label>
                  Service date
                  <input
                    name="date"
                    required
                    type="date"
                    min={new Date().toLocaleDateString("en-CA")}
                  />
                </label>
                <label>
                  Time slot
                  <select name="time">
                    <option>10:00</option>
                    <option>13:00</option>
                    <option>16:00</option>
                  </select>
                </label>
                <button className="button">Book demo service</button>
              </form>
              <Link to="/connect?kind=Repair">Request a repair quote</Link>{" "}
              <Link to="/account/bookings">View bookings</Link>
            </>
          )}
          <p role="status">{message}</p>
        </div>
      </div>
      {togetherId && !expired && (
        <section className="record commerce-buying">
          <h2>Buy Together</h2>
          <p>{money(groupPrice(price, groupTarget))} per unit at {groupTarget} units.</p>
          <p>{groupSeed + (demo.groups[togetherId] ?? 0)} units committed · Closes {new Date(demo.groupDeadline).toLocaleString("en-IN")}</p>
          <Link className="outline" to={`/listing/together/${togetherId}`}>Join Group</Link>
        </section>
      )}
      {sourcingProduct && supplierOffers.length > 0 && (
        <section className="commerce-buying">
          <h2>Where &amp; how to buy</h2>
          <p className="muted">Sample suppliers and prices. Pickup and stock availability require confirmation.</p>
          <div className="product-grid">
            {supplierOffers.map((offer) => {
              const supplier = suppliers.find((entry) => entry.id === offer.supplierId);
              if (!supplier) return null;
              return (
                <article key={offer.id} className="record">
                  <h3>{offer.method}</h3>
                  <Link to={`/sourcing/supplier/${supplier.id}`}>{supplier.name}</Link>
                  <p>{placeName(supplier.base)} · Minimum order {offer.moq}</p>
                  {offer.pickup && <p>Pickup location: {placeName(offer.pickup)}</p>}
                  <p>Sample lead time: {offer.leadDays} days</p>
                  <p>Delivery: {offer.shipping.length ? offer.shipping.join(", ") : "Ask supplier"}</p>
                  {offer.tiers.length > 0 && (
                    <ul>
                      {offer.tiers.map((tier) => (
                        <li key={tier.quantity}>
                          {tier.quantity}+ units · {formatMinor(tier.minor, offer.currency)} per unit
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link className="outline" to={`/connect?${new URLSearchParams({ offer: offer.id, quantity: String(offer.moq) })}`}>
                    {offer.custom ? "Request custom order" : "Request a quote"}
                  </Link>
                </article>
              );
            })}
          </div>
          <Link className="outline" to={`/sourcing/product/${sourcingProduct.id}`}>
            Compare sourcing offers
          </Link>
        </section>
      )}
      {item.section === "shop" && <PdpBuyingOptions item={item} variantId={variant.id} label={variant.label} quantity={quantity} />}
      {item.section === "shop" && (
        <>
          <section className="record">
            <h2>Product passport</h2>
            <dl>
              <dt>Brand</dt>
              <dd>{item.detail}</dd>
              <dt>Model</dt>
              <dd>{item.id.toUpperCase()}</dd>
              <dt>Origin and provenance</dt>
              <dd>
                Demo product record · Manufacturer and country of origin
                unverified
              </dd>
              <dt>Warranty</dt>
              <dd>12-month sample warranty on standard retail offer</dd>
            </dl>
            <div className="actions">
              <Link className="outline" to="/nearby">
                Find local pickup
              </Link>
              <Link className="outline" to="/together">
                Find group purchases
              </Link>
              <Link className="outline" to="/global">
                Browse manufacturers
              </Link>
              <Link className="outline" to="/care">
                Find repair services
              </Link>
              <Link
                className="outline"
                to={`/account/compare?first=${item.id}`}
              >
                Compare products
              </Link>
            </div>
            {item.id === "studio-headphones" && (
              <p>
                <Link to="/listing/shop/audio-pads">
                  Compatible replacement pads
                </Link>
              </p>
            )}
            {item.specifications && <><h3>Product specifications</h3><dl>{Object.entries(item.specifications).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>}
          </section>
          <h2>Related products</h2>
          <div className="product-grid">
            {products
              .filter((product) => product.id !== item.id && product.category === item.category).slice(0, 4)
              .map((product) => (
                <ListingCard item={product} key={product.id} />
              ))}
          </div>
        </>
      )}
    </Page>
  );
}
