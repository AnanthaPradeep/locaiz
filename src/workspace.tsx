import { marketClient } from "./market-foundation";
import { parseIntent } from "./buyer-intent";
import { BasketComparisonDemo, QuoteComparison } from "./quote-comparison";
import { MatchAlerts, SavedSearches } from "./saved-search-ui";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { asset, findListings, listings, money, products } from "./catalog";
import { ListingCard } from "./listing-card";
import { Missing, Page } from "./page";
import { useDemo, type Activity } from "./store";
import {
  alertSampleOffer,
  offers,
  placeName,
  places,
  products as sourcingProducts,
  suppliers,
} from "./sourcing/catalog";

const requirements = z.object({
  title: z.string().trim().min(3),
  kind: z.enum(["Retail", "Wholesale", "Manufacturing", "Repair"]),
  budget: z.number().positive().max(1e12).optional(),
  quantity: z.number().int().positive().max(1000000),
  needed: z.string(),
  city: z.string().trim().min(2).max(80),
});
const pickupEnquiryStatus = "Demo pickup enquiry saved";

export function RequirementForm() {
  const [params] = useSearchParams();
  const guided = params.get("find") === "1";
  const intent = parseIntent(params);
  const [review, setReview] = useState("");
  const demo = useDemo();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const sourcingOffer = (demo.includeAlertSample ? [...offers, alertSampleOffer] : offers).find(
    (offer) => offer.id === params.get("offer"),
  );
  const sourcingProduct = sourcingProducts.find(
    (product) => product.id === sourcingOffer?.productId,
  );
  const intendedSupplier = suppliers.find(
    (supplier) => supplier.id === sourcingOffer?.supplierId,
  );
  const { register, handleSubmit, formState } = useForm<
    z.infer<typeof requirements>
  >({
    defaultValues: {
      kind:
        (guided && intent.notes) ? "Manufacturing" :
        params.get("kind") === "Repair"
          ? "Repair"
          : sourcingOffer?.custom
            ? "Manufacturing"
            : params.get("kind") === "Manufacturing"
              ? "Manufacturing"
            : params.has("market") || sourcingOffer?.method === "Wholesale"
              ? "Wholesale"
              : "Retail",
      city: intent.city || demo.city,
      title: (guided && intent.query ? intent.query : sourcingProduct?.name) ?? params.get("product")?.slice(0, 120),
      budget: intent.budget,
      needed: intent.needed,
      quantity: guided ? intent.quantity ?? 1 : sourcingOffer
        ? Math.min(
            1000000,
            Math.max(Number(params.get("quantity")) || 1, sourcingOffer.moq),
          )
        : 1,
    },
  });
  const market = listings.find(
    (item) => item.section === "global" && item.id === params.get("market"),
  );
  if (
    params.get("pickup") === "1" &&
    sourcingOffer?.pickup &&
    sourcingProduct &&
    intendedSupplier
  ) {
    const pickup = placeName(sourcingOffer.pickup);
    const minimum = sourcingOffer.moq;
    return (
      <form
        className="record form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const quantity = Number(form.get("quantity"));
          if (
            !Number.isSafeInteger(quantity) ||
            quantity < minimum ||
            quantity > 1000000
          ) {
            setError("Enter a valid pickup quantity.");
            return;
          }
          const notes = String(form.get("notes") || "").trim();
          const date = String(form.get("pickupDate") || "");
          demo.add(
            "requirements",
            sourcingProduct.name,
            `Pickup enquiry · ${intendedSupplier.name} · ${pickup} · ${quantity} units${date ? ` · Preferred date ${date}` : ""}${notes ? ` · ${notes}` : ""}`,
            pickupEnquiryStatus,
          );
          navigate("/account/requirements");
        }}
      >
        <h2>Ask about pickup</h2>
        <p>
          {sourcingProduct.name} · {intendedSupplier.name}
        </p>
        <p>
          <strong>Sample pickup locality</strong> {pickup}
        </p>
        <p>
          Confirm the collection address, stock and time with the supplier
          before travelling. This demo saves the enquiry on this device.
        </p>
        <label>
          Pickup quantity
          <input
            name="quantity"
            type="number"
            min={minimum}
            max={1000000}
            required
            defaultValue={Math.min(
              1000000,
              Math.max(
                minimum,
                Math.trunc(Number(params.get("quantity"))) || minimum,
              ),
            )}
          />
        </label>
        <label>
          Preferred pickup date{" "}
          <input
            name="pickupDate"
            type="date"
            min={new Date().toLocaleDateString("en-CA")}
          />
        </label>
        <label>
          Notes{" "}
          <input
            name="notes"
            maxLength={500}
            placeholder="Ask about opening hours or pickup instructions"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button">Save pickup enquiry</button>
      </form>
    );
  }
  return (
    <form
      className="record form"
      onSubmit={handleSubmit((values, event) => {
        const result = requirements.safeParse({ ...values, budget: Number.isNaN(values.budget) ? undefined : values.budget });
        if (!result.success || (!guided && (!result.data.budget || !result.data.needed))) {
          setError(
            "Check the requirement, budget, quantity, date and delivery city.",
          );
          return;
        }
        const { title, kind, budget, quantity, needed, city } = result.data;
        const form =
          event?.target instanceof HTMLFormElement
            ? new FormData(event.target)
            : null;
        const destination = String(form?.get("destination") ?? "");
        const budgetCurrency = String(form?.get("budgetCurrency") ?? "INR");
        const budgetLabel = budget === undefined ? "Budget not specified" : (sourcingOffer || guided)
          ? new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: budgetCurrency,
            }).format(budget)
          : money(budget);
        const sourcing = sourcingOffer
          ? {
              offerId: sourcingOffer.id,
              quantity,
              destination,
              custom: form?.get("custom") === "on",
            }
          : undefined;
        if (
          sourcing &&
          (!Number.isSafeInteger(quantity) ||
            (!guided && quantity < sourcingOffer!.moq) ||
            quantity > 1000000 ||
            !places.some((place) => place.country === destination))
        ) {
          setError(
            "Choose a delivery country and enter a valid quantity for this offer.",
          );
          return;
        }
        const specifics = sourcing
          ? ` · Preferred supplier ${intendedSupplier?.name} · Delivery ${destination} · Specifications ${form?.get("specifications") || "Not supplied"}${sourcing.custom ? " · Custom order" : ""}${form?.get("sample") ? " · Sample requested" : ""}`
          : "";
        const specifications = String(form?.get("specifications") ?? "").trim();
        const unit = guided ? intent.unit : "units";
        const custom = form?.get("custom") === "on";
        const details = [
          title, kind, quantity + " " + unit, budget === undefined ? budgetLabel : budgetLabel + " budget",
          [city, destination].filter(Boolean).join(" / "), needed ? "needed " + needed : "No deadline specified",
          specifications, custom && "Customisation required", intendedSupplier && "Preferred supplier " + intendedSupplier.name,
          intent.sku && "Variant " + intent.sku,
        ].filter(Boolean).join(" / ");
        if (guided && review !== details) {
          setError("");
          setReview(details);
          return;
        }
        demo.add(
          "requirements", title,
          details + (market ? " / " + market.name : "") + (!guided ? specifics : ""),
          sourcing ? "Demo sourcing enquiry" : "Open",
          sourcing,
          { quantity, unit, destination: destination || city, deadline: needed || undefined, custom, budget,
            budgetCurrency: sourcing || guided ? budgetCurrency : "INR", specifications,
            ...(guided ? { buyerIntent: { ...intent, query: title, quantity, city, country: destination, needed, budget, currency: budgetCurrency, notes: specifications } } : {}),
          },
        );
        navigate("/account/requirements");
      })}
    >
      {market && <p>Request for {market.name} · sample wholesale market</p>}
      {(sourcingOffer || guided) && (
        <>
          <p>
            {intendedSupplier ? "Sample sourcing enquiry for " + intendedSupplier.name + "." : "Demo buyer requirement."} Saved on this
            device.
          </p>
          <label>
            Delivery country
            <select
              name="destination"
              required={!!sourcingOffer}
              defaultValue={intent.country || sourcingOffer?.shipping[0] || ""}
            >
              {!sourcingOffer && <option value="">Choose country</option>}
              {places
                .filter((place) => place.country)
                .map((place) => (
                  <option key={place.id} value={place.country}>
                    {place.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Specifications and notes
            <input name="specifications" maxLength={500} defaultValue={intent.notes} />
          </label>
          <label>
            <input
              type="checkbox"
              name="custom"
              defaultChecked={guided ? Boolean(intent.notes) : Boolean(sourcingOffer?.custom)}
            />{" "}
            Customisation needed
          </label>
          <label>
            <input type="checkbox" name="sample" /> Request a sample
          </label>
        </>
      )}
      <label>
        Requirement
        <input required minLength={3} maxLength={120} {...register("title")} />
      </label>
      <label>
        Request type
        <select {...register("kind")}>
          <option>Retail</option>
          <option>Wholesale</option>
          <option>Manufacturing</option>
          <option>Repair</option>
        </select>
      </label>
      {(sourcingOffer || guided) && (
        <label>
          Budget currency
          <select name="budgetCurrency" defaultValue={intent.budget ? intent.currency : sourcingOffer?.currency ?? "INR"}>
            {["INR", "CNY", "THB", "TRY", "VND", "USD", "EUR"].map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        {sourcingOffer || guided ? "Total budget" : "Total budget (₹)"}
        <input
          required={!guided}
          type="number"
          min={guided ? 0.01 : 1}
          step={guided ? "0.01" : "1"}
          {...register("budget", { valueAsNumber: true })}
        />
      </label>
      <label>
        Quantity
        <input
          required
          type="number"
          min={guided ? 1 : sourcingOffer?.moq ?? 1}
          {...register("quantity", { valueAsNumber: true })}
        />
      </label>
      <label>
        Needed by
        <input
          required={!guided}
          type="date"
          min={new Date().toLocaleDateString("en-CA")}
          {...register("needed")}
        />
      </label>
      <label>
        Delivery city
        <input required maxLength={80} {...register("city")} />
      </label>
      {review && <section className="record" aria-label="Requirement review"><h2>Review requirement</h2><p>{review}</p><p>Saved on this device in Demo Mode.</p></section>}
      <p role="alert">{error}</p>
      <button className="button" disabled={formState.isSubmitting}>
        {guided ? (review ? "Save demo requirement" : "Review requirement") : "Post demo requirement"}
      </button>
    </form>
  );
}

function Records({
  entries,
  empty,
  action,
}: {
  entries: Activity[];
  empty: string;
  action?: (entry: Activity) => ReactNode;
}) {
  return (
    <div className="records">
      {entries.length === 0 && <p className="record">{empty}</p>}
      {entries.map((entry) => (
        <article className="record" key={entry.id}>
          <h3>{entry.title}</h3>
          <p>{entry.detail}</p>
          <p className="muted">
            {new Date(entry.date).toLocaleDateString("en-IN")}
            {entry.status && ` · ${entry.status}`}
          </p>
          {action?.(entry)}
        </article>
      ))}
    </div>
  );
}

const accountLinks = [
  "Profile",
  "Wishlist",
  "Cart",
  "Orders",
  "Bookings",
  "Requirements",
  "Messages",
  "Notifications",
  "Saved Searches",
  "Settings",
];
const info: Record<string, string> = {
  help: "Search for a product, browse local shops, open a market or post a buyer requirement. Use Settings to switch themes and the location control to change demo cities.",
  privacy:
    "This demonstration stores activity and preferences in this browser. Location permission is optional and coordinates are used to match the closest demo city. Map imagery is served by OpenStreetMap.",
  terms:
    "Prices, availability, bookings, quotations and orders are illustrative. Demo actions do not make purchases, contact providers or send payments.",
};

export default function Workspace({
  business = false,
}: {
  business?: boolean;
}) {
  const { panel = "" } = useParams();
  const [params] = useSearchParams();
  const demo = useDemo();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState("");
  const [estimate, setEstimate] = useState("");
  const [first, setFirst] = useState(params.get("first") || products[0].id);
  const [second, setSecond] = useState(products[1].id);
  if (business) return <Business key={panel} panel={panel} />;
  if (Object.hasOwn(info, panel))
    return (
      <Page title={panel[0].toUpperCase() + panel.slice(1)} intro={info[panel]}>
        <Link to="/">Explore LOCAIZ</Link>
        {panel === "help" && <Link className="outline" to="/contact">Contact Us</Link>}
      </Page>
    );
  const unreadMatches = demo.matchAlerts.filter((alert) => !alert.read).length;
  const availableListings = demo.includeAlertSample
    ? findListings("", undefined, undefined, undefined, true)
    : listings;
  const lines = Object.entries(demo.cart).flatMap(([key, quantity]) => {
    const product = availableListings.find(
      (item) => item.id === key.split(":")[0] && item.section === "shop",
    );
    const variant = product && retailVariants(product).find((entry) => entry.cartKey === key);
    return product && variant && quantity > 0
      ? [
          {
            key,
            product,
            quantity,
            variant: variant.label,
            price: variant.price,
            stock: variant.stock,
            photo: variant.photos[0],
            sku: variant.sku,
          },
        ]
      : [];
  });
  const total = lines.reduce(
    (sum, { price, quantity }) => sum + price * quantity,
    0,
  );
  let content: ReactNode;
  let title = panel[0]?.toUpperCase() + panel.slice(1);
  switch (panel) {
    case "profile":
    case "login":
    case "register":
      content = (
        <form
          className="record form"
          onSubmit={(event) => {
            event.preventDefault();
            const name = String(
              new FormData(event.currentTarget).get("name"),
            ).trim();
            if (name) {
              demo.setPreference({ profile: name });
              setFeedback("Demo profile saved on this device.");
            }
          }}
        >
          <p>Local demo profile</p>
          <label>
            Display name
            <input
              required
              name="name"
              defaultValue={demo.profile}
              maxLength={60}
            />
          </label>
          <button className="button">Save demo profile</button>
          <div className="actions">
            <Link to="/account/addresses">Sample addresses</Link>
            <Link to="/account/recent">Recently viewed</Link>
          </div>
        </form>
      );
      break;
    case "settings":
      content = (
        <div className="record form">
          <label>
            Appearance
            <select
              value={demo.theme}
              onChange={(event) =>
                demo.setPreference({
                  theme: event.target.value === "dark" ? "dark" : "light",
                })
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label>
            Demo city
            <select
              value={demo.city}
              onChange={(event) =>
                demo.setPreference({ city: event.target.value })
              }
            >
              <option>Chennai</option>
              <option>Coimbatore</option>
            </select>
          </label>
        </div>
      );
      break;
    case "wishlist":
    case "recent": {
      title = panel === "recent" ? "Recently viewed" : "Wishlist";
      const ids = panel === "recent" ? demo.recent : demo.liked;
      content = ids.length ? (
        <div className="product-grid">
          {ids
            .map((id) => availableListings.find((item) => item.id === id))
            .map((item) => item && <ListingCard item={item} key={item.id} />)}
        </div>
      ) : (
        <p className="record">
          No products yet. <Link to="/shop">Browse the shop</Link>.
        </p>
      );
      break;
    }
    case "cart":
    case "checkout":
      title = panel === "checkout" ? "Demo checkout" : "Your cart";
      content = lines.length ? (
        <div className="records">
          {lines.map(({ key, product, quantity, variant, price, stock, photo, sku }) => (
            <div key={key} className="record cart-line">
              <div className="shopping-product">
                {photo && <img className="shopping-product-image" src={asset(`images/${photo}.webp`)} alt={product.name} loading="lazy" />}
                <div className="shopping-product-copy">
                  <Link to={`/listing/shop/${product.id}`}>
                    <strong>{product.name}</strong>
                  </Link>
                  <p className="muted">{product.detail} · {product.category}</p>
                  <p>
                    {variant} · {money(price)} per unit
                  </p>
                  <p className="muted">SKU {sku}</p>
                </div>
              </div>
              {panel === "cart" ? (
                <label>
                  Quantity
                  <input
                    type="number"
                    min={1}
                    max={stock}
                    aria-label={`Quantity for ${product.name}`}
                    value={quantity}
                    onChange={(event) => {
                      const value = event.target.valueAsNumber;
                      if (Number.isInteger(value) && value > 0 && value <= stock)
                        demo.setCart(key, value);
                    }}
                  />
                </label>
              ) : (
                <span>× {quantity}</span>
              )}
              <strong className="cart-line-subtotal">{money(price * quantity)}</strong>
              {panel === "cart" && (
                <button
                  className="outline"
                  onClick={() => demo.setCart(key, 0)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <div className="record">
            <h2>Total {money(total)}</h2>
            {panel === "cart" ? (
              <Link className="button" to="/account/checkout">
                Continue to demo checkout
              </Link>
            ) : (
              <form
                className="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const method = new FormData(event.currentTarget).get(
                    "method",
                  );
                  demo.checkout(
                    `${lines.map(({ product, variant, quantity }) => `${product.name} (${variant}) × ${quantity}`).join(", ")} · ${money(total)} · ${method}`,
                  );
                  navigate("/account/orders");
                }}
              >
                <label>
                  Fulfilment
                  <select name="method">
                    <option>Sample delivery</option>
                    <option>Sample pickup</option>
                  </select>
                </label>
                <button className="button">Place demo order</button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <p className="record">
          Your cart is empty. <Link to="/shop">Continue shopping</Link>.
        </p>
      );
      break;
    case "orders":
      content = (
        <Records
          entries={demo.orders}
          empty="Your demo orders will appear here."
        />
      );
      break;
    case "bookings":
      content = (
        <Records
          entries={demo.bookings}
          empty="You have no demo bookings."
          action={(entry) =>
            entry.status === "Confirmed" && (
              <button
                className="outline"
                onClick={() => {
                  if (window.confirm("Cancel this sample booking?"))
                    demo.update("bookings", entry.id, "Cancelled");
                }}
              >
                Cancel booking
              </button>
            )
          }
        />
      );
      break;
    case "stock":
      title = "Stock checks · Demo Mode";
      content = (
        <Records
          entries={demo.stock.map((entry) => ({
            ...entry,
            status:
              Date.now() - Date.parse(entry.date) >= 86400000
                ? "Expired"
                : entry.status,
          }))}
          empty="No stock requests yet."
          action={(entry) =>
            entry.status === "Pending" && (
              <div className="actions">
                {["Available · demo", "Unavailable · demo"].map((status) => (
                  <button
                    className="outline"
                    key={status}
                    onClick={() => demo.update("stock", entry.id, status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            )
          }
        />
      );
      break;
    case "requirements":
      content = (
        <>
          <Link className="button" to="/connect">
            Post a requirement
          </Link>
          <BasketComparisonDemo />
          <Records
            entries={demo.requirements}
            empty="Your requirements will appear here."
            action={(entry) => {
              if (entry.status === pickupEnquiryStatus) return null;
              const decision = demo.quoteWorkspaces[entry.id]?.decisions.at(-1);
              return <>
                {decision && <p>Selected quote: {decision.supplierName ?? decision.supplierId}
                  {decision.warnings.length > 0 && " / " + decision.warnings.join(" / ")}
                </p>}
                <Link className="outline" to={"/account/quotes?id=" + entry.id}>
                  Compare sample quotations
                </Link>
              </>;
            }}
          />
        </>
      );
      break;
    case "quotes": {
      title = "Quotation comparison";
      const request = demo.requirements.find(
        (item) => item.id === params.get("id"),
      );
      if (!request) {
        content = <Link to="/account/requirements">Choose a requirement</Link>;
        break;
      }
      if (request.status === pickupEnquiryStatus) {
        title = "Pickup enquiry";
        content = (
          <>
            <p>{request.detail}</p>
            <Link to="/account/requirements">Back to requirements</Link>
          </>
        );
        break;
      }
      content = <QuoteComparison key={request.id} request={request} />;
      break;
    }
    case "messages":
    case "addresses":
    case "groups": {
      const collection = panel === "groups" ? "createdGroups" : panel;
      if (panel === "groups") title = "Group purchases";
      const recipient = params.get("to") || "Demo support";
      content = (
        <>
          {panel === "groups" && (
            <Records
              entries={findListings("", "together")
                .filter((item) => demo.groups[item.id] > 0)
                .map((item) => ({
                  id: item.id,
                  title: item.name,
                  detail: `${demo.groups[item.id]} units pledged`,
                  date: new Date(demo.groupDeadline).toISOString(),
                  status:
                    demo.groupDeadline < Date.now() ? "Expired" : "Joined",
                }))}
              empty="You have no active memberships."
              action={(entry) => (
                <Link to={`/listing/together/${entry.id}`}>
                  Manage membership
                </Link>
              )}
            />
          )}
          <form
            className="record form"
            onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              const value = String(fields.get("value")).trim();
              if (!value) return;
              const detail =
                panel === "groups"
                  ? `Target: ${fields.get("target")} units · Ends ${fields.get("deadline")}`
                  : value;
              demo.add(
                collection,
                panel === "messages"
                  ? recipient
                  : panel === "groups"
                    ? value
                    : "Demo address",
                detail,
                panel === "groups" ? "Draft" : undefined,
              );
              event.currentTarget.reset();
              setFeedback("Saved locally.");
            }}
          >
            <label>
              {panel === "messages"
                ? `Sample message to ${recipient}`
                : panel === "groups"
                  ? "Group purchase name"
                  : "Sample address"}
              <input required name="value" maxLength={160} />
            </label>
            {panel === "groups" && (
              <>
                <label>
                  Quantity target
                  <input required name="target" type="number" min={2} />
                </label>
                <label>
                  Deadline
                  <input
                    required
                    name="deadline"
                    type="date"
                    min={new Date().toLocaleDateString("en-CA")}
                  />
                </label>
              </>
            )}
            <button className="button">
              {panel === "groups" ? "Create group draft" : "Save demo entry"}
            </button>
          </form>
          <Records
            entries={demo[collection]}
            empty="No saved entries."
            action={
              panel === "groups"
                ? (entry) =>
                    entry.status !== "Cancelled" && (
                      <button
                        className="outline"
                        onClick={() =>
                          demo.update("createdGroups", entry.id, "Cancelled")
                        }
                      >
                        Cancel group
                      </button>
                    )
                : undefined
            }
          />
        </>
      );
      break;
    }
    case "saved-searches":
      title = "Saved searches";
      content = <SavedSearches />;
      break;
    case "notifications":
      content = (
        <>
          <Link className="outline" to="/account/stock-notifications">
            Stock notifications
          </Link>
          <MatchAlerts />
          <Records
            entries={[
              ...demo.orders,
              ...demo.bookings,
              ...demo.requirements,
            ].sort((a, b) => b.date.localeCompare(a.date))}
            empty="No marketplace activity yet."
          />
        </>
      );
      break;
    case "compare":
      title = "Compare products";
      content = (
        <div className="split">
          {[first, second].map((id, index) => {
            const item =
              listings.find(
                (entry) => entry.id === id && entry.section === "shop",
              ) ?? products[0];
            return (
              <div className="record" key={index}>
                <label>
                  {index === 0 ? "First product" : "Second product"}
                  <select
                    value={item.id}
                    onChange={(event) =>
                      (index === 0 ? setFirst : setSecond)(event.target.value)
                    }
                  >
                    {findListings("", "shop").map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <dl>
                  <dt>Seller</dt>
                  <dd>{item.detail}</dd>
                  <dt>Unit price</dt>
                  <dd>{money(item.price ?? 0)}</dd>
                  <dt>Delivery estimate</dt>
                  <dd>3–5 days · {money(99)} sample freight</dd>
                  <dt>Estimated total</dt>
                  <dd>{money((item.price ?? 0) + 99)}</dd>
                  <dt>Verification</dt>
                  <dd>Demo seller</dd>
                </dl>
                <Link to={`/listing/shop/${item.id}`}>
                  View product passport
                </Link>
              </div>
            );
          })}
        </div>
      );
      break;
    case "repair-assistant":
      title = "Repair or replace";
      content = (
        <form
          className="record form"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const repair = Number(data.get("repair"));
            const replacement = Number(data.get("replacement"));
            const ratio = repair / replacement;
            const older =
              Number(data.get("age")) >= 7 || data.get("condition") === "Poor";
            const underWarranty = data.get("warranty") === "Active";
            setEstimate(
              `The quote is ${Math.round(ratio * 100)}% of replacement cost. ${underWarranty ? "Ask whether the warranty covers the work." : ratio < (older ? 0.4 : 0.6) ? "The estimate favours repair on cost." : "Consider replacement and ask the provider about remaining lifespan."}`,
            );
          }}
        >
          <p>
            Compare costs and condition. A professional can assess the fault.
          </p>
          <label>
            Repair quote (₹)
            <input name="repair" type="number" min={0} required />
          </label>
          <label>
            Replacement cost (₹)
            <input name="replacement" type="number" min={1} required />
          </label>
          <label>
            Appliance age in years
            <input name="age" type="number" min={0} required />
          </label>
          <label>
            Condition
            <select name="condition">
              <option>Good</option>
              <option>Fair</option>
              <option>Poor</option>
            </select>
          </label>
          <label>
            Warranty
            <select name="warranty">
              <option>Unknown</option>
              <option>Active</option>
              <option>Expired</option>
            </select>
          </label>
          <button className="button">Compare costs</button>
          <p role="status">{estimate}</p>
        </form>
      );
      break;
    default:
      return <Missing />;
  }
  return (
    <Page title={title} label="YOUR LOCAIZ">
      <nav className="panel-nav" aria-label="Account sections">
        <Link to="/account/buying-journey">My Buying Journey</Link>
        {marketClient && <Link to="/account/journey">Buyer workspace</Link>}
        {accountLinks.map((link) => (
          <Link key={link} to={`/account/${link.toLowerCase().replaceAll(" ", "-")}`}>
            {link}
            {link === "Notifications" && unreadMatches > 0 && ` (${unreadMatches} unread matches)`}
          </Link>
        ))}
      </nav>
      {content}
      <p role="status">{feedback}</p>
    </Page>
  );
}

const businessPanels = [
  "Dashboard",
  "Onboarding",
  "Products",
  "Inventory",
  "Quotations",
  "Orders",
  "Services",
  "Bookings",
  "Analytics",
  "Settings",
  "Admin",
];

export function Business({ panel }: { panel: string }) {
  const demo = useDemo();
  const [feedback, setFeedback] = useState("");
  if (!businessPanels.some((value) => value.toLowerCase() === panel))
    return <Missing />;
  const name = businessPanels.find((value) => value.toLowerCase() === panel)!;
  return (
    <Page
      title={`Business ${name.toLowerCase()}`}
      label="LOCAIZ BUSINESS"
      intro="Local demo workspace · Verification unsubmitted"
    >
      <nav className="panel-nav" aria-label="Business sections">
        {marketClient && <Link to="/business/studio">Seller Studio</Link>}
        {marketClient && <Link to="/business/journey">Seller enquiries</Link>}
        <Link to="/sourcing/onboarding">Create supplier storefront</Link>
        <Link to="/business/stock">Stock Requests</Link>
        {businessPanels.map((link) => (
          <Link key={link} to={`/business/${link.toLowerCase()}`}>
            {link}
          </Link>
        ))}
      </nav>
      {(panel === "onboarding" || panel === "settings") && (
        <form
          className="record form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            demo.setPreference({
              business: `${String(data.get("name")).trim()} · ${data.get("role")}`,
            });
            setFeedback("Sample business profile saved.");
          }}
        >
          <label>
            Business name
            <input
              required
              name="name"
              maxLength={90}
              defaultValue={demo.business.split(" · ")[0]}
            />
          </label>
          <label>
            Business type
            <select name="role" defaultValue={demo.business.split(" · ")[1]}>
              <option>Retailer</option>
              <option>Wholesaler</option>
              <option>Manufacturer</option>
              <option>Service professional</option>
            </select>
          </label>
          <button className="button">Save business profile</button>
        </form>
      )}
      {["products", "inventory", "services"].includes(panel) && (
        <>
          <form
            className="record form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              demo.add(
                "inventory",
                String(data.get("name")).trim(),
                `${panel === "services" ? "Service" : "Product"} · ${money(Number(data.get("price")))} · ${data.get("quantity")} units/slots`,
                "Draft",
              );
              event.currentTarget.reset();
            }}
          >
            <label>
              Listing name
              <input name="name" required maxLength={120} />
            </label>
            <label>
              Price (₹)
              <input name="price" type="number" min={1} required />
            </label>
            <label>
              Stock or available slots
              <input name="quantity" type="number" min={0} required />
            </label>
            <button className="button">Add demo listing</button>
          </form>
          <Records
            entries={demo.inventory.filter(
              (item) =>
                panel === "inventory" ||
                item.detail.startsWith(
                  panel === "services" ? "Service" : "Product",
                ),
            )}
            empty="No listings yet."
            action={(entry) =>
              entry.status?.startsWith("Storefront draft") ? (
                <p>Awaiting connected supplier review</p>
              ) : (
                <button
                  className="outline"
                  onClick={() =>
                    demo.update(
                      "inventory",
                      entry.id,
                      entry.status === "Published" ? "Draft" : "Published",
                    )
                  }
                >
                  {entry.status === "Published"
                    ? "Unpublish"
                    : "Publish locally"}
                </button>
              )
            }
          />
        </>
      )}
      {panel === "orders" && (
        <Records
          entries={demo.orders}
          empty="No sample orders on this device."
          action={(entry) =>
            entry.status === "Confirmed" && (
              <button
                className="outline"
                onClick={() => demo.update("orders", entry.id, "Fulfilled")}
              >
                Mark fulfilled
              </button>
            )
          }
        />
      )}
      {panel === "bookings" && (
        <Records
          entries={demo.bookings}
          empty="No sample bookings on this device."
          action={(entry) =>
            entry.status === "Confirmed" && (
              <button
                className="outline"
                onClick={() => demo.update("bookings", entry.id, "Completed")}
              >
                Mark completed
              </button>
            )
          }
        />
      )}
      {panel === "quotations" && (
        <Records
          entries={demo.requirements}
          empty="No buyer requirements on this device."
          action={(entry) => (
            <Link to={`/account/quotes?id=${entry.id}`}>
              View sample quotations
            </Link>
          )}
        />
      )}
      {["dashboard", "analytics", "admin"].includes(panel) && (
        <>
          <h2>{demo.business || "Your sample business"}</h2>
          <div className="category-grid">
            {[
              [demo.inventory.length, "Listings", "inventory"],
              [demo.orders.length, "Orders", "orders"],
              [demo.bookings.length, "Bookings", "bookings"],
              [demo.requirements.length, "Requirements", "quotations"],
            ].map(([value, label, route]) => (
              <Link key={route} to={`/business/${route}`}>
                <strong>{value}</strong>
                {label}
              </Link>
            ))}
          </div>
          {!demo.business && (
            <Link className="button" to="/business/onboarding">
              Set up a business
            </Link>
          )}
        </>
      )}
      <p role="status">{feedback}</p>
    </Page>
  );
}
import { retailVariants } from "./product-commerce";
