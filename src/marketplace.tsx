import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { Link, useMatch, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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

const MarketMap = lazy(() => import("./market-map"));

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
  const active = modules.find((module) => module.id === section);
  const search = Boolean(useMatch("/search"));
  const term = params.get("q") ?? "";
  const query = useQuery({
    queryKey: ["catalog", term],
    queryFn: () => demoCatalog.search(term),
    enabled: search,
  });
  const setOption = (name: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    });
  if (id) {
    const item = findListings("", active?.id as Section).find(
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
        <RequirementForm />
      </Page>
    );
  if (section === "business") return <Business panel="dashboard" />;
  const items = search
    ? (query.data ?? [])
    : findListings(
        "",
        section as Section,
        "",
        section === "nearby" ? city : "",
      );
  const category = params.get("category") ?? "";
  const country = params.get("country") ?? "";
  const sort = params.get("sort") ?? "";
  const distance = params.get("distance") ?? "";
  const filtered = items.filter(
    (item) =>
      (!category || item.category === category) &&
      (!country || country === item.detail) &&
      (!distance || (item.distance ?? Infinity) <= Number(distance)),
  );
  if (sort)
    filtered.sort((a, b) =>
      sort === "price"
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : a.name.localeCompare(b.name),
    );
  const canMap = section === "nearby" || section === "global";
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
      <div className="filterbar">
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
            <option value="price">Price, low to high</option>
          </select>
        </label>
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
      <p className="muted">
        {filtered.length} {filtered.length === 1 ? "result" : "results"}
        {section === "nearby" ? ` in ${city}` : ""}
      </p>
      {filtered.length === 0 && !query.isLoading && (
        <p className="record">No listings match these filters.</p>
      )}
      <div className="product-grid">
        {filtered.map((item) => (
          <ListingCard item={item} key={item.id} />
        ))}
      </div>
    </Page>
  );
}

function ListingDetail({ item }: { item: Listing }) {
  const demo = useDemo();
  const [quantity, setQuantity] = useState(1);
  const [option, setOption] = useState("Standard");
  const [photo, setPhoto] = useState(item.image);
  const [message, setMessage] = useState("");
  const price = item.price ?? 0;
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
        {photo ? (
          <div>
            <img
              className="detail-image"
              src={asset(`images/${photo}.webp`)}
              alt={item.name}
            />
            {item.id === "studio-headphones" && (
              <div className="actions">
                <button
                  className="outline"
                  onClick={() => setPhoto("headphones")}
                >
                  Studio photo
                </button>
                <button className="outline" onClick={() => setPhoto("hero")}>
                  Editorial photo
                </button>
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
          {item.section === "shop" && (
            <>
              <h2>{money(price)}</h2>
              <label>
                Variant
                <select
                  value={option}
                  onChange={(event) => setOption(event.target.value)}
                >
                  <option>Standard</option>
                  <option>Gift packaging</option>
                </select>
              </label>
              <label>
                Quantity
                <input
                  min={1}
                  max={99}
                  type="number"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.valueAsNumber)}
                />
              </label>
              <div className="actions">
                <button
                  className="button"
                  disabled={
                    !Number.isInteger(quantity) || quantity < 1 || quantity > 99
                  }
                  onClick={() => {
                    const key =
                      option === "Standard" ? item.id : `${item.id}:gift`;
                    demo.setCart(key, (demo.cart[key] ?? 0) + quantity);
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
              <Link to="/account/cart">View cart</Link>
              <p>
                Demo delivery in 3–5 days. Sample pickup may be available
                locally.
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
            <h3>Sample review · 4/5</h3>
            <p>“Comfortable to use every day.”</p>
          </section>
          <h2>Related products</h2>
          <div className="product-grid">
            {products
              .filter((product) => product.id !== item.id)
              .map((product) => (
                <ListingCard item={product} key={product.id} />
              ))}
          </div>
        </>
      )}
    </Page>
  );
}
