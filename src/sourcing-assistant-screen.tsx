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
