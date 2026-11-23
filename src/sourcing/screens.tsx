import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Page, Missing } from "../page";
import { stockEnabled, stockPath } from "../stock/config";
import { useDemo } from "../store";
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

export default function Sourcing() {
  const { kind, id } = useParams();
  if (kind === "supplier" && id) {
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) return <Missing />;
    const selection = offers.filter((offer) => offer.supplierId === id);
    return (
      <Page
        title={supplier.name}
        label="ILLUSTRATIVE SUPPLIER"
        intro={supplier.roles.join(" · ")}
      >
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
        <h2>Compare supplier offers</h2>
        <div className="records">
          {offers
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
  const results = searchOffers(params);
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
      intro="Explore village artisans, local workshops and global manufacturing hubs. Supplier profiles, stock and offers in this directory are illustrative."
    >
      <nav className="actions" aria-label="Sourcing shortcuts">
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
      <div className="record sourcing-filters">
        <label>
          Find products, places or makers
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
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
            ["view", "View", ["grid", "list", "map"]],
          ] as const
        ).map(([key, label, options]) => (
          <label key={key}>
            {label}
            <select
              value={params.get(key) ?? (key === "view" ? "grid" : "")}
              onChange={(event) => filter(key, event.target.value)}
            >
              {key !== "view" && <option value="">All</option>}
              {options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Delivery country
          <select
            value={params.get("destination") ?? ""}
            onChange={(event) => filter("destination", event.target.value)}
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
            checked={params.has("pickup")}
            onChange={(event) =>
              filter("pickup", event.target.checked ? "1" : "")
            }
          />{" "}
          Pickup offered
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
      <nav className="actions" aria-label="Location hierarchy">
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
      <nav className="actions" aria-label="Child locations">
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
      <p role="status">
        {results.length} sample offers from{" "}
        {new Set(results.map((result) => result.supplier.id)).size} suppliers
      </p>
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
      <div className={view === "grid" ? "sourcing-grid" : "records"}>
        {results
          .slice((page - 1) * pageSize, page * pageSize)
          .map(({ offer }) => (
            <OfferCard key={offer.id} offer={offer} />
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

function OfferCard({ offer }: { offer: Offer }) {
  const product = products.find((item) => item.id === offer.productId)!;
  const supplier = suppliers.find((item) => item.id === offer.supplierId)!;
  const [quantity, setQuantity] = useState(offer.moq);
  const unit = unitPrice(offer, quantity);
  return (
    <article className="record sourcing-offer">
      <span className="eyebrow">{offer.method} · Sample offer</span>
      <h3>
        <Link to={`/sourcing/product/${product.id}`}>{product.name}</Link>
      </h3>
      <p>
        <Link to={`/sourcing/supplier/${supplier.id}`}>{supplier.name}</Link> ·{" "}
        {supplier.roles.join(", ")}
      </p>
      <dl>
        <dt>Product origin · illustrative</dt>
        <dd>{placeName(product.origin)}</dd>
        <dt>Supplier base</dt>
        <dd>{placeName(supplier.base)}</dd>
        <dt>Stock location</dt>
        <dd>
          {offer.stock
            ? `${placeName(offer.stock)} · availability unconfirmed`
            : "Made to order or stock unreported"}
        </dd>
        <dt>Pickup location</dt>
        <dd>{offer.pickup ? placeName(offer.pickup) : "Ask supplier"}</dd>
        <dt>Ships from</dt>
        <dd>{offer.shipFrom ? placeName(offer.shipFrom) : "Ask supplier"}</dd>
        <dt>Sample delivery coverage</dt>
        <dd>{offer.shipping.map(countryName).join(", ") || "Ask supplier"}</dd>
        <dt>Order terms</dt>
        <dd>
          MOQ {offer.moq} · {offer.leadDays} day illustrative lead time
        </dd>
      </dl>
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
          to={`/connect?offer=${offer.id}&quantity=${Number.isSafeInteger(quantity) && quantity <= 1000000 ? Math.max(quantity, offer.moq) : offer.moq}`}
        >
          {offer.custom ? "Request custom order" : "Request a quote"}
        </Link>
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
