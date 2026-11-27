import { SavedSearchButton } from "../saved-search-ui";
import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { Page, Missing } from "../page";
import { asset } from "../catalog";
import { MapPin, Package, Search, SlidersHorizontal } from "lucide-react";
import { stockEnabled, stockPath } from "../stock/config";
import { useDemo } from "../store";
import { PublishedSourcing } from "./published";
import { RegionalMakers } from "./regional";
import { sampleRegionalMakers } from "./regional-data";
import { regionalDirectoryHref, regionalRequestHref } from "../regional-crafts";
import {
  ancestry,
  categories,
  formatMinor,
  methods,
  offers,
  placeName,
  places,
  products,
  roles,
  searchOffers,
  alertSampleOffer,
  suppliers,
  unitPrice,
  type Offer,
} from "./catalog";
import "./styles.css";

const Map = lazy(() => import("../market-map"));
const countries = places.filter((place) => place.country);
const countryName = (code: string) =>
  countries.find((place) => place.country === code)?.name ?? code;
const linkFor = (key: string, value: string) =>
  `/sourcing?${new URLSearchParams({ [key]: value })}`;
const pageSize = 8;
const offerLink = (offer: Offer, quantity = offer.moq, pickup = false) =>
  `/connect?${new URLSearchParams({ offer: offer.id, quantity: String(quantity), ...(pickup ? { pickup: "1" } : {}) })}`;
const productImage = (id: string) => asset(`images/sourcing/${id}.webp`);

export default function Sourcing() {
  const sample = useDemo((state) => state.includeAlertSample);
  const catalogueOffers = sample ? [...offers, alertSampleOffer] : offers;
  const { kind, id } = useParams();
  const [params] = useSearchParams();
  if (kind === "regional") return <RegionalMakers />;
  if (kind === "published") return <PublishedSourcing />;
  if (kind === "supplier" && id) {
    const supplier = suppliers.find((item) => item.id === id);
    const sampleMaker = sampleRegionalMakers.find((maker) => maker.id === id);
    const regional = sampleMaker && (params.get("craft") === sampleMaker.craft || !supplier);
    if (!supplier && !sampleMaker) return <Missing />;
    const selection = catalogueOffers.filter((offer) => offer.supplierId === id);
    return (
      <Page
        title={supplier?.name ?? sampleMaker!.name}
        label="ILLUSTRATIVE SUPPLIER"
        intro={supplier?.roles.join(" · ") ?? "Artisan workshop sample profile"}
      >
        {regional && (
          <section className="record market-stack" aria-label="Regional craft">
            <Link to={regionalDirectoryHref(sampleMaker.region, sampleMaker.craft)}>Back to regional makers</Link>
            <h2>{sampleMaker.craft}</h2>
            <p>{sampleMaker.locality} · Illustrative maker and order terms</p>
            <p>Minimum order {sampleMaker.minimum}
              {sampleMaker.custom && " · Custom orders accepted"}
              {sampleMaker.pickup && " · Pickup offered"}
            </p>
            <Link className="button" to={regionalRequestHref(sampleMaker.region, sampleMaker.craft, false, sampleMaker)}>Start a sourcing request</Link>
          </section>
        )}
        {supplier && <>
        <Link to={linkFor("place", supplier.base)}>
          {ancestry(supplier.base)
            .map((place) => place.name)
            .join(" / ")}
        </Link>
        <dl className="record">
          <dt>Registered base</dt>
          <dd>{placeName(supplier.base)}</dd>
          <dt>Manufacturing location</dt>
          <dd>
            {supplier.production
              ? placeName(supplier.production)
              : "Unreported"}
          </dd>
          <dt>Verification</dt>
          <dd>Unverified demonstration profile</dd>
          <dt>Languages</dt>
          <dd>{supplier.languages.join(", ")}</dd>
        </dl>
        <h2>Products and offers</h2>
        <div className="records">
          {selection.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
        </>}
      </Page>
    );
  }
  if (kind === "product" && id) {
    const product = products.find((item) => item.id === id);
    if (!product) return <Missing />;
    return (
      <Page
        title={product.name}
        label="PRODUCT PASSPORT · DEMO DATA"
        intro={`${product.category} · ${product.variant}`}
      >
        <div className="sourcing-passport">
          <img
            src={productImage(product.id)}
            alt={product.name + " · illustrative product image"}
            width={384}
            height={341}
          />
          <dl className="record">
            <dt>Claimed product origin</dt>
            <dd>
              <Link to={linkFor("place", product.origin)}>
                {ancestry(product.origin)
                  .map((place) => place.name)
                  .join(" / ")}
              </Link>
            </dd>
            <dt>Manufacturing method</dt>
            <dd>{product.method}</dd>
            {Object.entries(product.specs).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            <dt>Provenance and certification</dt>
            <dd>
              Illustrative claims. Independent verification and certificates
              unavailable.
            </dd>
          </dl>
        </div>
        <h2>Compare supplier offers</h2>
        <div className="records">
          {catalogueOffers
            .filter((offer) => offer.productId === id)
            .map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
        </div>
      </Page>
    );
  }
  if (kind === "onboarding") return <Onboarding />;
  return kind ? <Missing /> : <Explore />;
}

function Explore() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get("q") ?? "");
  const savedQuery = params.get("q") ?? "";
  useEffect(() => setDraft(savedQuery), [savedQuery]);
  useEffect(() => {
    if (draft === savedQuery) return;
    const timer = setTimeout(
      () =>
        setParams(
          (previous) => {
            const updated = new URLSearchParams(previous);
            if (draft) updated.set("q", draft);
            else updated.delete("q");
            updated.delete("page");
            return updated;
          },
          { replace: true },
        ),
      250,
    );
    return () => clearTimeout(timer);
  }, [draft, savedQuery, setParams]);
  function filter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  const location = params.get("place") ?? "";
  const children = places.filter((place) =>
    location ? place.parent === location : !place.parent,
  );
  const includeAlertSample = useDemo((state) => state.includeAlertSample);
  const results = searchOffers(params, includeAlertSample);
  const page = Math.min(
    Math.max(1, Math.trunc(Number(params.get("page"))) || 1),
    Math.max(1, Math.ceil(results.length / pageSize)),
  );
  const view = params.get("view") ?? "grid";
  const mapItems = [
    ...new Set(results.map((result) => result.supplier.base)),
  ].flatMap((id) => {
    const place = places.find((item) => item.id === id);
    return place?.coords
      ? [
          {
            id,
            name: place.name,
            section: "global" as const,
            category: place.kind,
            detail: "",
            coords: place.coords,
          },
        ]
      : [];
  });
  return (
    <Page
      title="Discover where the world makes."
      label="VILLAGE TO GLOBAL"
      intro="Find village crafts, workshop parts and factory-made goods. Compare sample offers and ask suppliers about pickup."
    >
      <SavedSearchButton scope="sourcing" params={params} />
      {stockEnabled && <Link className="outline" to="/sourcing/published">Published supplier offers</Link>}
      <nav
        className="actions sourcing-shortcuts"
        aria-label="Sourcing shortcuts"
      >
        <Link className="outline" to="/sourcing/regional">Regional makers</Link>
        <Link className="outline" to={linkFor("role", "Artisan")}>
          Village artisans
        </Link>
        <Link className="outline" to={linkFor("role", "Workshop")}>
          Manufacturing workshops
        </Link>
        <Link className="outline" to={linkFor("role", "Large manufacturer")}>
          Global manufacturers
        </Link>
        <Link
          className="outline"
          to={linkFor("category", "Wholesale and industrial")}
        >
          Industrial sourcing
        </Link>
      </nav>
      <div className="sourcing-controls">
        <div className="sourcing-filters">
          <label className="sourcing-search">
            <span>Find products, places or makers</span>
            <span className="sourcing-search-box">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                placeholder="Try handwoven mats or Shenzhen"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </span>
          </label>
          <label>
            Location
            <select
              value={location}
              onChange={(event) => filter("place", event.target.value)}
            >
              <option value="">All locations</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name} · {place.kind}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={params.get("category") ?? ""}
              onChange={(event) => filter("category", event.target.value)}
            >
              <option value="">All categories</option>
              {Object.entries(categories).map(([group, leaves]) => (
                <optgroup key={group} label={group}>
                  <option>{group}</option>
                  {leaves.map((leaf) => (
                    <option key={leaf}>{leaf}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {(
            [
              ["role", "Supplier type", roles],
              ["method", "Purchase method", methods],
            ] as const
          ).map(([key, label, options]) => (
            <label key={key}>
              {label}
              <select
                value={params.get(key) ?? ""}
                onChange={(event) => filter(key, event.target.value)}
              >
                <option value="">All</option>
                {options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="sourcing-options">
          <label className="sourcing-check">
            <input
              type="checkbox"
              checked={params.has("pickup")}
              onChange={(event) =>
                filter("pickup", event.target.checked ? "1" : "")
              }
            />
            <MapPin size={16} aria-hidden="true" /> Pickup offered
          </label>
          <details className="sourcing-more">
            <summary>
              <SlidersHorizontal size={16} aria-hidden="true" /> More filters
              {["destination", "maxMoq", "custom"].some((key) =>
                params.has(key),
              )
                ? " · Active"
                : ""}
            </summary>
            <div className="sourcing-extra">
              <label>
                Delivery country
                <select
                  value={params.get("destination") ?? ""}
                  onChange={(event) =>
                    filter("destination", event.target.value)
                  }
                >
                  <option value="">Any destination</option>
                  {countries.map((place) => (
                    <option key={place.id} value={place.country}>
                      {place.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Maximum MOQ
                <input
                  type="number"
                  min="1"
                  value={params.get("maxMoq") ?? ""}
                  onChange={(event) => filter("maxMoq", event.target.value)}
                />
              </label>
              <label className="sourcing-check">
                <input
                  type="checkbox"
                  checked={params.has("custom")}
                  onChange={(event) =>
                    filter("custom", event.target.checked ? "1" : "")
                  }
                />{" "}
                Custom orders
              </label>
            </div>
          </details>
          {[
            "q",
            "place",
            "category",
            "role",
            "method",
            "destination",
            "maxMoq",
            "pickup",
            "custom",
          ].some((key) => params.has(key)) && (
            <Link className="sourcing-reset" to="/sourcing">
              Clear filters
            </Link>
          )}
        </div>
      </div>
      <div className="sourcing-geography">
        <nav
          className="actions sourcing-crumbs"
          aria-label="Location hierarchy"
        >
          <button className="outline" onClick={() => filter("place", "")}>
            World
          </button>
          {ancestry(location).map((place) => (
            <button
              className="outline"
              key={place.id}
              onClick={() => filter("place", place.id)}
            >
              {place.name}
            </button>
          ))}
        </nav>
        {children.length > 0 && (
          <nav
            className="actions sourcing-children"
            aria-label="Child locations"
          >
            {children.map((place) => (
              <button
                className="outline"
                key={place.id}
                onClick={() => filter("place", place.id)}
              >
                {place.name}
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="sourcing-results">
        <div>
          <h2>Supplier offers</h2>
          <p role="status">
            {results.length} sample offers from{" "}
            {new Set(results.map((result) => result.supplier.id)).size}{" "}
            suppliers
          </p>
        </div>
        <label>
          View
          <select
            value={view}
            onChange={(event) => filter("view", event.target.value)}
          >
            <option value="grid">Grid</option>
            <option value="list">List</option>
            <option value="map">Map</option>
          </select>
        </label>
      </div>
      {view === "map" && mapItems.length > 0 && (
        <Suspense fallback={<p>Loading sourcing map…</p>}>
          <Map items={mapItems} hrefFor={(item) => linkFor("place", item.id)} />
        </Suspense>
      )}
      {!results.length && (
        <p className="record">
          No sample offers match these filters.{" "}
          <Link to="/sourcing">Reset filters</Link>.
        </p>
      )}
      <div
        className={
          view === "grid" ? "sourcing-grid" : "sourcing-grid sourcing-list"
        }
      >
        {results
          .slice((page - 1) * pageSize, page * pageSize)
          .map(({ offer }) => (
            <OfferPreview key={offer.id} offer={offer} />
          ))}
      </div>
      {results.length > pageSize && (
        <div className="actions sourcing-pages">
          <button
            className="outline"
            disabled={page === 1}
            onClick={() => filter("page", String(page - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(results.length / pageSize)}
          </span>
          <button
            className="outline"
            disabled={page * pageSize >= results.length}
            onClick={() => filter("page", String(page + 1))}
          >
            Next
          </button>
        </div>
      )}
    </Page>
  );
}

function OfferPreview({ offer }: { offer: Offer }) {
  const product = products.find((item) => item.id === offer.productId)!;
  const supplier = suppliers.find((item) => item.id === offer.supplierId)!;
  const unit = unitPrice(offer, offer.moq);
  const productPath = `/sourcing/product/${product.id}`;
  return (
    <article className="sourcing-preview">
      <div className="sourcing-image">
        <img
          src={productImage(product.id)}
          alt={product.name + " · illustrative product image"}
          width={384}
          height={341}
          loading="lazy"
          decoding="async"
        />
        <span>{offer.method}</span>
      </div>
      <div className="sourcing-preview-body">
        <div className="sourcing-identity">
          <h3>
            <Link to={productPath}>{product.name}</Link>
          </h3>
          <p>
            <Link to={`/sourcing/supplier/${supplier.id}`}>
              {supplier.name}
            </Link>
          </p>
          <p className="muted">Origin · {placeName(product.origin)}</p>
        </div>
        <div className="sourcing-price">
          <div>
            <span>Sample unit price</span>
            <strong>
              {unit === undefined
                ? "On request"
                : formatMinor(unit, offer.currency)}
            </strong>
          </div>
          <div>
            <span>Minimum order</span>
            <strong>
              {offer.moq} {offer.moq === 1 ? "unit" : "units"}
            </strong>
          </div>
        </div>
        <div className="sourcing-pickup">
          {offer.pickup ? (
            <MapPin size={18} aria-hidden="true" />
          ) : (
            <Package size={18} aria-hidden="true" />
          )}
          <div>
            <strong>
              {offer.pickup
                ? `Pickup in ${placeName(offer.pickup)}`
                : "Pickup by enquiry"}
            </strong>
            <span>
              {offer.pickup
                ? "Ask about stock and collection time"
                : "Ask the supplier about collection"}
            </span>
          </div>
        </div>
        <div className="sourcing-card-actions">
          <Link
            className="button"
            to={
              offer.pickup
                ? offerLink(offer, offer.moq, true)
                : offerLink(offer)
            }
          >
            {offer.pickup ? "Ask about pickup" : "Request quote"}
          </Link>
          <Link className="outline" to={productPath}>
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === "#" + offer.id) document.getElementById(offer.id)?.scrollIntoView({ block: "center" });
  }, [hash, offer.id]);
  const product = products.find((item) => item.id === offer.productId)!;
  const supplier = suppliers.find((item) => item.id === offer.supplierId)!;
  const [quantity, setQuantity] = useState(offer.moq);
  const unit = unitPrice(offer, quantity);
  return (
    <article id={offer.id} className="record sourcing-offer">
      <span className="eyebrow">{offer.method} · Sample offer</span>
      <h3>
        <Link to={`/sourcing/product/${product.id}`}>{product.name}</Link>
      </h3>
      <p>
        <Link to={`/sourcing/supplier/${supplier.id}`}>{supplier.name}</Link> ·{" "}
        {supplier.roles.join(", ")}
      </p>
      <dl>
        <div>
          <dt>Product origin · illustrative</dt>
          <dd>{placeName(product.origin)}</dd>
        </div>
        <div>
          <dt>Supplier base</dt>
          <dd>{placeName(supplier.base)}</dd>
        </div>
        <div>
          <dt>Stock location</dt>
          <dd>
            {offer.stock
              ? `${placeName(offer.stock)} · availability unconfirmed`
              : "Made to order or stock unreported"}
          </dd>
        </div>
        <div>
          <dt>Ships from</dt>
          <dd>{offer.shipFrom ? placeName(offer.shipFrom) : "Ask supplier"}</dd>
        </div>
        <div>
          <dt>Sample delivery coverage</dt>
          <dd>
            {offer.shipping.map(countryName).join(", ") || "Ask supplier"}
          </dd>
        </div>
        <div>
          <dt>Order terms</dt>
          <dd>
            MOQ {offer.moq} · {offer.leadDays} day illustrative lead time
          </dd>
        </div>
      </dl>
      {offer.pickup && (
        <div className="sourcing-pickup">
          <MapPin size={18} aria-hidden="true" />
          <div>
            <strong>Pickup in {placeName(offer.pickup)}</strong>
            <span>
              Confirm stock, collection time and the address with the supplier.
            </span>
          </div>
        </div>
      )}
      {offer.tiers.length > 0 && (
        <>
          <label>
            Offer quantity
            <input
              type="number"
              min={offer.moq}
              max={1000000}
              value={quantity || ""}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </label>
          <p role="status">
            {unit === undefined
              ? `Minimum order ${offer.moq}`
              : `${formatMinor(unit, offer.currency)} per unit · ${formatMinor(unit * quantity, offer.currency)} items subtotal`}
          </p>
          <p className="muted">Shipping, tax and import duty unquoted.</p>
        </>
      )}
      <div className="actions">
        <Link
          className="button"
          to={offerLink(
            offer,
            Number.isSafeInteger(quantity) && quantity <= 1000000
              ? Math.max(quantity, offer.moq)
              : offer.moq,
          )}
        >
          {offer.custom ? "Request custom order" : "Request a quote"}
        </Link>
        {offer.pickup && (
          <Link
            className="outline"
            to={offerLink(
              offer,
              Number.isSafeInteger(quantity) && quantity <= 1000000
                ? Math.max(quantity, offer.moq)
                : offer.moq,
              true,
            )}
          >
            Ask about pickup
          </Link>
        )}
        {product.legacyId && (
          <Link
            className="outline"
            to={
              offer.method === "Local retail" && stockEnabled
                ? stockPath(product.legacyId)
                : `/listing/shop/${product.legacyId}`
            }
          >
            {offer.method === "Local retail" && stockEnabled
              ? "Check participating pilot shops"
              : "View retail product"}
          </Link>
        )}
      </div>
    </article>
  );
}

function Onboarding() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const add = useDemo((state) => state.add);
  const navigate = useNavigate();
  const steps = [
    "Identity",
    "Locations",
    "Capabilities",
    "Catalogue",
    "Fulfilment",
    "Review",
  ];
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      ...draft,
      ...Object.fromEntries(new FormData(event.currentTarget)),
    } as Record<string, string>;
    setDraft(next);
    if (step < steps.length - 1) setStep(step + 1);
    else {
      add(
        "inventory",
        next.name,
        Object.entries(next)
          .filter(([, value]) => value)
          .map(
            ([key, value]) =>
              `${key} · ${key === "base" || key === "production" ? placeName(value) : value}`,
          )
          .join(" / "),
        "Storefront draft · Unverified",
      );
      navigate("/business/inventory");
    }
  }
  const field = (name: string, label: string, required = true) => (
    <label>
      {label}
      <input
        name={name}
        defaultValue={draft[name]}
        maxLength={120}
        required={required}
      />
    </label>
  );
  return (
    <Page
      title="Supplier storefront"
      label="LOCAIZ BUSINESS · DEMO MODE"
      intro="Create a local storefront draft. Use fictional details. Public publication and document review require a connected supplier service."
    >
      <form key={step} className="record form" onSubmit={save}>
        <h2>{steps[step]}</h2>
        <p>
          Step {step + 1} of {steps.length}
        </p>
        {step === 0 && (
          <>
            {field("name", "Business name")}
            <label>
              Supplier type
              <select name="type" defaultValue={draft.type}>
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
            {field("description", "Business description")}
          </>
        )}
        {step === 1 && (
          <>
            {["base", "production"].map((key, index) => (
              <label key={key}>
                {index === 0 ? "Business base" : "Manufacturing location"}
                <select
                  name={key}
                  defaultValue={draft[key] ?? ""}
                  required={index === 0}
                >
                  <option value="">Select a location</option>
                  {places
                    .filter((place) => place.coords)
                    .map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.name}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </>
        )}
        {step === 2 && (
          <>
            {field("speciality", "Production speciality")}{" "}
            {field("capacity", "Production capacity", false)}
            <label>
              Purchase method
              <select name="method" defaultValue={draft.method}>
                {methods.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {step === 3 && (
          <>
            {field("product", "Product name")}
            {field("variant", "Variant", false)}
            {field("specs", "Specifications", false)}
            <label>
              Product category
              <select name="category" defaultValue={draft.category}>
                {Object.values(categories)
                  .flat()
                  .map((category) => (
                    <option key={category}>{category}</option>
                  ))}
              </select>
            </label>
          </>
        )}
        {step === 4 && (
          <>
            <label>
              Minimum order quantity
              <input
                name="moq"
                type="number"
                min="1"
                max="1000000"
                defaultValue={draft.moq ?? "1"}
                required
              />
            </label>
            {field("delivery", "Delivery coverage")}
            {field("lead", "Production lead time", false)}
          </>
        )}
        {step === 5 && (
          <>
            <p>Unverified draft preview</p>
            <dl>
              {Object.entries(draft)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>
                      {key === "base" || key === "production"
                        ? placeName(value)
                        : value}
                    </dd>
                  </div>
                ))}
            </dl>
          </>
        )}
        <div className="actions">
          {step > 0 && (
            <button
              type="button"
              className="outline"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          <button className="button">
            {step === 5 ? "Save storefront draft" : "Continue"}
          </button>
        </div>
      </form>
    </Page>
  );
}
