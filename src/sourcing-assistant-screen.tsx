import { useQuery } from "@tanstack/react-query";
import { publishedCatalogue } from "./sourcing/repository";
import { formatMinor } from "./sourcing/catalog";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "./page";
import { marketClient } from "./market-foundation";
import {
  buildSourcingDraft,
  sourcingDraftSchema,
  type SourcingDraft,
} from "./sourcing-assistant";

const textFields = [
  ["category", "Product category"],
  ["description", "Product description"],
  ["customisation", "Customisation"],
  ["materials", "Materials"],
  ["dimensions", "Dimensions"],
  ["destination", "Delivery destination"],
  ["currency", "Currency code"],
] as const;

function SupplierMatches({
  draft,
  ready,
}: {
  draft: SourcingDraft;
  ready: boolean;
}) {
  const [requested, setRequested] = useState("");
  const [country, setCountry] = useState("");
  const query = useQuery({
    queryKey: ["market", "assistant-published-suppliers", requested],
    enabled: requested === draft.description && requested.length >= 3,
    queryFn: () =>
      publishedCatalogue(marketClient!).offers({
        keyword: requested,
        verifiedOnly: true,
        marketplaceOnly: true,
      }),
  });
  const active = requested === draft.description && requested.length >= 3;
  return (
    <section
      className="record journey-stack"
      aria-label="Published supplier suggestions"
    >
      <h3>Published supplier suggestions</h3>
      <p>
        Search uses the product description in the LOCAIZ catalogue. Quantity
        and destination checks run in this browser.
      </p>
      <label>
        Destination country code for coverage check
        <input
          maxLength={2}
          value={country}
          onChange={(event) => setCountry(event.target.value.toUpperCase())}
        />
      </label>
      <button
        className="outline"
        onClick={() => setRequested(draft.description)}
      >
        Search published suppliers
      </button>
      {active && query.isPending && (
        <p role="status">Searching verified supplier listings</p>
      )}
      {active && query.isError && (
        <p role="alert">
          Unable to search published suppliers.{" "}
          <button className="outline" onClick={() => void query.refetch()}>
            Retry supplier search
          </button>
        </p>
      )}
      {active && query.isSuccess && !query.data.items.length && (
        <p>No published verified offers match this description.</p>
      )}
      {active &&
        query.data?.items.map((offer) => {
          const delivery =
            country.length === 2 && offer.shipping_countries.length
              ? offer.shipping_countries.some(
                  (value) => value.toUpperCase() === country,
                )
              : undefined;
          return (
            <article key={offer.id} className="record market-stack">
              <h4>{offer.sourcing_variants.sourcing_products.name}</h4>
              <Link to={"/supplier/" + offer.sourcing_businesses.id}>
                {offer.sourcing_businesses.name}
              </Link>
              <p>
                Product title matched your description. Supplier lists{" "}
                {offer.method.toLowerCase()}.
              </p>
              <p>
                MOQ {offer.minimum_quantity}
                {draft.quantity && draft.quantity < offer.minimum_quantity
                  ? " · Requested quantity is below MOQ"
                  : ""}
              </p>
              <p>
                {delivery === false
                  ? "Supplier does not list shipping to " + country
                  : delivery === true
                    ? "Supplier lists shipping to " + country
                    : "Confirm destination coverage with the supplier."}
              </p>
              <p>
                {offer.currency} ·{" "}
                {offer.unit_price_minor === null
                  ? "Quote required"
                  : formatMinor(offer.unit_price_minor, offer.currency) +
                    " listed per unit"}
              </p>
              {ready && (
                <Link
                  to={
                    "/account/journey?" +
                    new URLSearchParams({
                      new: "1",
                      supplier: offer.sourcing_businesses.id,
                      product: offer.product_id,
                      variant: offer.variant_id,
                    })
                  }
                  state={{ sourcingDraft: draft }}
                >
                  Review RFQ for supplier
                </Link>
              )}
            </article>
          );
        })}
    </section>
  );
}
export default function SourcingAssistant() {
  const [brief, setBrief] = useState("");
  const [draft, setDraft] = useState<SourcingDraft>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const valid = draft && sourcingDraftSchema.safeParse(draft).success;
  const ready =
    valid &&
    draft.description.length >= 3 &&
    draft.destination.length >= 2 &&
    !!draft.quantity &&
    !!draft.unit &&
    (!draft.budget || !!draft.currency);
  return (
    <Page
      title="Sourcing Assistant"
      intro="Turn a sourcing brief into fields you can review and edit."
    >
      <div className="journey-stack">
        <form
          className="journey-panel journey-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setPending(true);
            setDraft(undefined);
            void buildSourcingDraft(brief)
              .then(setDraft)
              .catch(() =>
                setError(
                  "Could not build the draft. Check the brief and try again.",
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          <p>Local draft builder. Your brief is processed in this browser.</p>
          <label>
            Describe what you need
            <textarea
              maxLength={2000}
              minLength={3}
              required
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
            />
          </label>
          <button className="button" disabled={pending}>
            Extract draft
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
        {draft && (
          <section
            className="journey-panel journey-form"
            aria-label="Editable sourcing draft"
          >
            <h2>Review your draft</h2>
            <p>
              Fields come from the brief or your edits. Add details for any
              blank fields that matter to your order.
            </p>
            <div className="journey-fields">
              {textFields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={draft[key]}
                    maxLength={
                      key === "currency"
                        ? 3
                        : key === "customisation"
                          ? 500
                          : key === "materials" || key === "dimensions"
                            ? 300
                            : key === "category"
                              ? 100
                              : 120
                    }
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        [key]:
                          key === "currency"
                            ? event.target.value.toUpperCase()
                            : event.target.value,
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Quantity
                <input
                  type="number"
                  min={1}
                  max={1000000}
                  value={draft.quantity ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      quantity: event.currentTarget.valueAsNumber || null,
                    })
                  }
                />
              </label>
              <label>
                Unit
                <select
                  value={draft.unit}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      unit: event.target.value as SourcingDraft["unit"],
                    })
                  }
                >
                  <option value="">Select unit</option>
                  <option>units</option>
                  <option>sets</option>
                  <option>pairs</option>
                </select>
              </label>
              <label>
                Budget amount
                <input
                  type="number"
                  min={0.01}
                  max={1e9}
                  step="0.01"
                  value={draft.budget ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      budget: event.currentTarget.valueAsNumber || null,
                    })
                  }
                />
              </label>
              <label>
                Delivery deadline
                <input
                  type="date"
                  value={draft.deadline}
                  onChange={(event) =>
                    setDraft({ ...draft, deadline: event.target.value })
                  }
                />
              </label>
            </div>
            {!ready && (
              <p>
                Enter a product description, quantity, unit, destination, and a
                currency if you provide a budget.
              </p>
            )}
            {valid && draft.description.trim().length >= 3 && (
              <Link
                to={
                  "/search?" +
                  new URLSearchParams({
                    find: "1",
                    q: draft.description,
                    ...(draft.quantity ? { qty: String(draft.quantity) } : {}),
                  })
                }
              >
                Compare catalogue buying options
              </Link>
            )}
            {valid && marketClient && draft.description.length >= 3 && (
              <SupplierMatches draft={draft} ready={Boolean(ready)} />
            )}
            {ready && marketClient && (
              <Link
                className="button"
                to="/account/journey?new=1"
                state={{ sourcingDraft: draft }}
              >
                Review live RFQ
              </Link>
            )}
            {ready && !marketClient && (
              <p>
                Live RFQ submission requires a connected marketplace account.
              </p>
            )}
          </section>
        )}
      </div>
    </Page>
  );
}
