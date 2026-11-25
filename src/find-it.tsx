import { useLocale } from "./i18n";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { asset, money, type Listing } from "./catalog";
import { places, formatMinor, placeName } from "./sourcing/catalog";
import { useDemo } from "./store";
import { pilotId, stockEnabled, stockPath } from "./stock/config";
import { SavedSearchButton } from "./saved-search-ui";
import {
  connectIntent,
  intentParams,
  parseIntent,
  productIntent,
  retailOptions,
  sourcingOptions,
  unitOptions,
  type BuyerIntent,
} from "./buyer-intent";

export function FindProductForm({
  intent,
  existing,
}: {
  intent?: BuyerIntent;
  existing?: URLSearchParams;
}) {
  const {t}=useLocale();
  const navigate = useNavigate();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inputs = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget))
      if (typeof value === "string" && value) inputs.set(key, value);
    if (!inputs.get("q")?.trim()) return;
    const parsed = parseIntent(inputs);
    const next = new URLSearchParams(existing);
    for (const key of Object.keys(
      Object.fromEntries(new FormData(event.currentTarget)),
    ))
      next.delete(key);
    for (const [key, value] of intentParams(parsed)) next.set(key, value);
    next.delete("page");
    if (parsed.query !== intent?.query) {
      next.delete("item");
      next.delete("sku");
    }
    next.set("find", "1");
    navigate("/search?" + next);
  }
  return (
    <form className="find-form" onSubmit={submit}>
      <div className="find-query">
        <label>
          {t("What are you looking for?")}
          <input
            name="q"
            required
            maxLength={120}
            defaultValue={intent?.query}
            placeholder="e.g. Natural rattan basket"
          />
        </label>
        <button className="button">Find a product</button>
      </div>
      <details
        open={
          !!intent &&
          Boolean(
            intent.quantity ||
            intent.city ||
            intent.country ||
            intent.needed ||
            intent.notes ||
            intent.budget,
          )
        }
      >
        <summary>Quantity, location and other details</summary>
        <div className="find-fields">
          <label>
            Quantity
            <input
              name="qty"
              type="number"
              min="1"
              max="1000000"
              defaultValue={intent?.quantity}
            />
          </label>
          <label>
            Unit
            <select name="uom" defaultValue={intent?.unit ?? "units"}>
              {unitOptions.map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
          </label>
          <label>
            City
            <input name="city" maxLength={100} defaultValue={intent?.city} />
          </label>
          <label>
            Delivery country
            <select name="destination" defaultValue={intent?.country ?? ""}>
              <option value="">Choose country</option>
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
            Needed by
            <input name="needed" type="date" defaultValue={intent?.needed} />
          </label>
          <label>
            Preferred pickup date
            <input
              name="pickupDate"
              type="date"
              defaultValue={intent?.pickupDate}
            />
          </label>
          <label>
            Total budget
            <input
              name="budget"
              type="number"
              min="0.01"
              max="1000000000000"
              step="0.01"
              defaultValue={intent?.budget}
            />
          </label>
          <label>
            Currency
            <select name="currency" defaultValue={intent?.currency ?? "INR"}>
              {["INR", "USD", "CNY", "EUR"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Customisation or specifications
            <input
              name="customNotes"
              maxLength={500}
              defaultValue={intent?.notes}
            />
          </label>
        </div>
      </details>
    </form>
  );
}

function pickupUrl(item: Listing, label: string, intent: BuyerIntent) {
  if (
    !stockEnabled ||
    pilotId !== "nagercoil" ||
    !["studio-headphones", "audio-pads"].includes(item.id) ||
    !["Standard", "Gift packaging"].includes(label) ||
    (intent.city && intent.city.toLowerCase() !== "nagercoil") ||
    (intent.country && intent.country !== "IN") ||
    intent.unit !== "units" ||
    (intent.quantity ?? 1) > 99
  )
    return undefined;
  return stockPath(item.id, label, {
    quantity: intent.quantity,
    pickup: intent.pickupDate,
    note: intent.notes,
  });
}

export function PdpBuyingOptions({
  item,
  variantId,
  label,
  quantity,
}: {
  item: Listing;
  variantId: string;
  label: string;
  quantity: number;
}) {
  const [params] = useSearchParams();
  const intent = productIntent(
    {
      ...parseIntent(params),
      quantity:
        Number.isSafeInteger(quantity) && quantity > 0 ? quantity : undefined,
    },
    item,
    variantId,
  );
  const link = intentParams(intent);
  link.set("find", "1");
  return (
    <section className="record find-stack" aria-label="Buying options">
      <h2>Buying options</h2>
      <p>
        {label} / {intent.quantity ?? 1} {intent.unit}
      </p>
      <div className="actions">
        <Link className="outline" to={"/search?" + link}>
          Explore buying options
        </Link>
        <Link to={connectIntent(intent)}>Request sourcing</Link>
      </div>
    </section>
  );
}

const groups = [
  "Pickup nearby",
  "Buy ready-made",
  "Source or make to order",
] as const;
export function FindBuyingOptions({ params }: { params: URLSearchParams }) {
  const intent = parseIntent(params);
  const cart = useDemo((state) => state.cart);
  const deal = useDemo((state) => state.groupDeadline) > Date.now();
  const sample = useDemo((state) => state.includeAlertSample);
  const [group, setGroup] = useState<(typeof groups)[number]>("Buy ready-made");
  const retail = retailOptions(intent, params, cart, deal);
  const sourcing = sourcingOptions(intent, sample);
  const nearby = retail.flatMap(({ item, variant }) => {
    const href = pickupUrl(item, variant.label, intent);
    return href ? [{ item, variant, href }] : [];
  });
  const quote = connectIntent(intent);
  const hasIntent = !!(intent.query || intent.item);
  const loosen = new URLSearchParams(params);
  const optional = [
    "maxPrice",
    "material",
    "feature",
    "brand",
    "category",
  ].find((key) => loosen.has(key));
  if (optional) {
    loosen.delete(optional);
    loosen.delete("page");
  }
  const broader = new URLSearchParams(params);
  const nextQuery = intent.query.replace(
    /^(handmade|custom|personalised|personalized)\s+/i,
    "",
  );
  broader.set("q", nextQuery);
  broader.delete("page");
  return (
    <div className="find-stack">
      <FindProductForm
        key={params.toString()}
        intent={intent}
        existing={params}
      />
      {hasIntent && (
        <>
          <p>
            {[
              intent.query,
              intent.quantity && intent.quantity + " " + intent.unit,
              intent.city,
              intent.country &&
                places.find((p) => p.country === intent.country)?.name,
              intent.needed && "Needed by " + intent.needed,
              intent.notes && "Custom specifications supplied",
            ]
              .filter(Boolean)
              .join(" / ")}
          </p>
          <SavedSearchButton scope="search" params={params} />
          <nav aria-label="Buying options" className="actions find-groups">
            {groups.map((value, index) => (
              <button
                key={value}
                className="outline"
                aria-pressed={group === value}
                onClick={() => setGroup(value)}
              >
                {value} (
                {[nearby.length, retail.length, sourcing.length][index]})
              </button>
            ))}
          </nav>
          {group === "Pickup nearby" && (
            <section className="find-stack">
              <h2>Pickup nearby</h2>
              {!nearby.length && (
                <p>
                  {stockEnabled
                    ? "No participating stock pilot option for these criteria."
                    : "The stock pilot is unavailable in this demo. Pickup availability is unconfirmed."}
                </p>
              )}
              {nearby.map(({ item, variant, href }) => (
                <article className="record" key={item.id}>
                  <h3>{item.name}</h3>
                  <p>
                    {variant.label} / Nagercoil pilot / {intent.quantity ?? 1}{" "}
                    units
                  </p>
                  <p>
                    Check stock for a shop reply. Availability is unconfirmed.
                  </p>
                  <Link className="outline" to={href}>
                    Check stock
                  </Link>
                </article>
              ))}
            </section>
          )}
          {group === "Buy ready-made" && (
            <section className="find-stack">
              <h2>Buy ready-made</h2>
              <div className="find-cards">
                {retail.map(({ item, variant, available }) => {
                  const product = intentParams(
                    productIntent(intent, item, variant.id),
                  );
                  return (
                    <article className="record find-card" key={item.id}>
                      {variant.photos[0] && (
                        <img
                          src={asset("images/" + variant.photos[0] + ".webp")}
                          alt=""
                          loading="lazy"
                        />
                      )}
                      <h3>
                        <Link to={"/listing/shop/" + item.id + "?" + product}>
                          {item.name}
                        </Link>
                      </h3>
                      <p>
                        {item.detail} / {variant.label} / {money(variant.price)}{" "}
                        per unit
                      </p>
                      <p>
                        {intent.unit !== "units"
                          ? "Requested unit of measure needs confirmation"
                          : available < (intent.quantity ?? 1)
                            ? "Insufficient demo stock for requested quantity"
                            : available +
                              " demo units available after cart limits"}
                      </p>
                      <p>
                        {intent.notes
                          ? "Customisation needs confirmation. "
                          : ""}
                        Delivery date unconfirmed.
                      </p>
                    </article>
                  );
                })}
              </div>
              {!retail.length && (
                <p>
                  No matching ready-made products.{" "}
                  {nextQuery !== intent.query && !intent.notes && (
                    <Link to={"/search?" + broader}>
                      Search more broadly for {nextQuery}
                    </Link>
                  )}{" "}
                  {optional && (
                    <Link to={"/search?" + loosen}>
                      Remove the{" "}
                      {optional === "maxPrice" ? "maximum price" : optional}{" "}
                      filter
                    </Link>
                  )}
                </p>
              )}
            </section>
          )}
          {group === "Source or make to order" && (
            <section className="find-stack">
              <h2>Source or make to order</h2>
              {!sourcing.length && (
                <p>
                  No sample supplier offer matches these keywords. Describe the
                  item in a sourcing request.
                </p>
              )}
              <div className="find-cards">
                {sourcing.map(
                  ({ offer, supplier, product, warnings, unit }) => (
                    <article className="record find-card" key={offer.id}>
                      <h3>
                        <Link
                          to={
                            "/sourcing/product/" + product.id + "#" + offer.id
                          }
                        >
                          {product.name}
                        </Link>
                      </h3>
                      <p>
                        {supplier.name} / {supplier.roles.join(", ")} /{" "}
                        {placeName(supplier.base)}
                      </p>
                      <p>
                        Made in {placeName(product.origin)} / {offer.method} /
                        MOQ {offer.moq}
                      </p>
                      <p>
                        {unit === undefined
                          ? "Price or applicable quantity tier on request"
                          : formatMinor(unit, offer.currency) +
                            " per unit"}{" "}
                        / {offer.leadDays} days production
                      </p>
                      <p>
                        Shipping cost and arrival date unconfirmed.{" "}
                        {offer.pickup && "Pickup offered, stock unconfirmed."}
                      </p>
                      {!!warnings.length && <p>{warnings.join(". ")}.</p>}
                      <Link
                        className="outline"
                        to={connectIntent(intent, offer.id)}
                      >
                        Request quote
                      </Link>
                    </article>
                  ),
                )}
              </div>
              <Link
                to={
                  "/sourcing?" +
                  new URLSearchParams({
                    q: intent.query,
                    ...(intent.country ? { destination: intent.country } : {}),
                  })
                }
              >
                Explore related suppliers in Global Atlas
              </Link>
            </section>
          )}
          <Link className="button" to={quote}>
            Request custom sourcing
          </Link>
        </>
      )}
    </div>
  );
}
