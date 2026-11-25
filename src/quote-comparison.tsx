import { SupplierQuoteTable } from "./supplier-quote-table";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDemo, type Activity, type QuoteWorkspace } from "./store";
import { basketFixtureId, quotesFor } from "./quote-catalogue";
import { evaluateQuote, type Quote } from "./quote-evaluation";
import { formatMinor } from "./sourcing/catalog";

const empty: QuoteWorkspace = {
  selected: [],
  shortlist: [],
  drafts: {},
  decisions: [],
};

export function BasketComparisonDemo() {
  const add = useDemo((state) => state.addBasketDemo);
  return (
    <Link
      className="outline"
      to={"/account/quotes?id=" + basketFixtureId}
      onClick={add}
    >
      Try demo quote comparison
    </Link>
  );
}

export function QuoteComparison({ request }: { request: Activity }) {
  const [params, setParams] = useSearchParams();
  const sample = useDemo((state) => state.includeAlertSample);
  const work = useDemo((state) => state.quoteWorkspaces[request.id]) ?? empty;
  const update = useDemo((state) => state.updateQuoteWorkspace);
  const updateActivity = useDemo((state) => state.update);
  const [feedback, setFeedback] = useState("");
  const [differences, setDifferences] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [clarify, setClarify] = useState("");
  const context = {
    quantity: request.sourcing?.quantity,
    destination: request.sourcing?.destination,
    custom: request.sourcing?.custom,
    ...request.quoteContext,
    ...work.context,
  };
  const quotes = quotesFor(request, sample);
  const chosen = work.selected
    .flatMap((id) => quotes.filter((quote) => quote.id === id))
    .slice(0, 3);
  const compare = params.get("view") === "compare" && chosen.length >= 2;
  const clock = new Date();
  const report = (quote: Quote) => evaluateQuote(quote, context, clock);
  const latest = work.decisions.at(-1);
  const latestQuote = quotes.find((quote) => quote.id === latest?.quoteId);
  const legacyAction = !request.sourcing && request.id !== basketFixtureId;

  function toggle(id: string, list: "selected" | "shortlist") {
    update(request.id, (previous) => {
      const values = previous[list];
      if (list === "selected" && !values.includes(id) && values.length >= 3)
        return previous;
      return {
        ...previous,
        [list]: values.includes(id)
          ? values.filter((value) => value !== id)
          : [...values, id],
      };
    });
  }
  function setCompare(active: boolean) {
    const next = new URLSearchParams(params);
    if (active) next.set("view", "compare");
    else next.delete("view");
    setParams(next);
  }
  function saveContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const quantity = Number(data.get("quantity"));
    const destination = String(data.get("destination") ?? "").trim();
    const deadline = String(data.get("deadline") ?? "");
    update(request.id, (previous) => ({
      ...previous,
      context: {
        quantity,
        destination,
        deadline: deadline || undefined,
        custom: data.has("custom"),
      },
    }));
    setFeedback("Comparison details updated.");
  }
  function decide(quote: Quote) {
    const current = report(quote);
    if (current.expired) return;
    update(request.id, (previous) => {
      const last = previous.decisions.at(-1);
      if (
        last?.quoteId === quote.id &&
        last.revision === quote.revision &&
        last.quantity === context.quantity &&
        last.destination === context.destination
      )
        return previous;
      return {
        ...previous,
        decisions: [
          ...previous.decisions,
          {
            quoteId: quote.id,
            supplierId: quote.supplierId ?? quote.id,
            supplierName: quote.supplier,
            revision: quote.revision,
            quantity: context.quantity,
            destination: context.destination,
            warnings: [
              ...current.warnings,
              ...(current.completeness === "Fully quoted"
                ? []
                : [current.completeness]),
            ],
            date: new Date().toISOString(),
            status: "selected",
          },
        ],
      };
    });
    setConfirm("");
    if (legacyAction)
      updateActivity(
        "requirements",
        request.id,
        "Accepted · " + quote.supplier,
      );
    setFeedback("Quote choice recorded on this device.");
  }

  const rows: { label: string; value: (quote: Quote) => string }[] = [
    {
      label: "Supplier type and location",
      value: (q) => q.role + " / " + q.location,
    },
    { label: "Eligibility", value: (q) => report(q).eligibility },
    { label: "Quote completeness", value: (q) => report(q).completeness },
    { label: "Original currency", value: (q) => q.currency },
    { label: "Minimum order quantity", value: (q) => String(q.moq) },
    {
      label: "Unit price at requested quantity",
      value: (q) =>
        amount(report(q).unit, q.currency, "On request / quantity unavailable"),
    },
    {
      label: "Quantity price tiers",
      value: (q) =>
        q.tiers
          .map(
            (tier) =>
              tier.quantity + "+: " + formatMinor(tier.minor, q.currency),
          )
          .join(" / ") || "On request",
    },
    {
      label: "Item subtotal",
      value: (q) => amount(report(q).subtotal, q.currency),
    },
    ...["Shipping", "Packaging", "Tax", "Insurance", "Duties", "Other"].map(
      (label) => ({
        label,
        value: (q: Quote) =>
          typeof q.fees[label] === "number"
            ? formatMinor(q.fees[label], q.currency)
            : q.fees[label] === "pending"
              ? "Awaiting quotation"
              : (q.fees[label] ?? "Awaiting quotation"),
      }),
    ),
    { label: "Known costs", value: (q) => amount(report(q).known, q.currency) },
    {
      label: "Complete quoted total",
      value: (q) =>
        amount(report(q).total, q.currency, "Incomplete / unavailable"),
    },
    { label: "Production lead time", value: (q) => days(q.lead) },
    { label: "Transit time", value: (q) => days(q.transit) },
    { label: "Estimated delivery", value: (q) => days(report(q).estimate) },
    { label: "Deadline suitability", value: (q) => report(q).timeline },
    {
      label: "Delivery coverage",
      value: (q) => q.destinations?.join(", ") || "Unconfirmed",
    },
    {
      label: "Pickup",
      value: (q) =>
        q.pickup ? q.pickup + " / stock unconfirmed" : "Not specified",
    },
    {
      label: "Customisation",
      value: (q) =>
        q.custom === undefined
          ? "Unconfirmed"
          : q.custom
            ? "Offered"
            : "Unsupported",
    },
    { label: "Validity", value: (q) => q.validUntil ?? "Not specified" },
    {
      label: "Warnings",
      value: (q) => report(q).warnings.join(" / ") || "None identified",
    },
  ];

  const sameCurrency = new Set(chosen.map((q) => q.currency)).size === 1;
  const eligibleQuotes = chosen.filter(
    (q) => report(q).eligibility === "Meets requirement",
  );
  const comparable = eligibleQuotes.filter(
    (q) => report(q).total !== undefined,
  );
  const minimumTotal =
    sameCurrency && comparable.length > 1
      ? Math.min(...comparable.map((q) => report(q).total!))
      : undefined;
  const shortestEstimate = eligibleQuotes.reduce<number | undefined>(
    (best, q) => {
      const estimate = report(q).estimate;
      return estimate === undefined
        ? best
        : Math.min(best ?? estimate, estimate);
    },
    undefined,
  );

  function actions(quote: Quote) {
    const current = report(quote);
    return (
      <div className="quote-stack">
        <div className="actions">
          <button
            className="outline"
            aria-pressed={work.shortlist.includes(quote.id)}
            onClick={() => toggle(quote.id, "shortlist")}
          >
            Shortlist
          </button>
          <button
            className="outline"
            onClick={() => setClarify(clarify === quote.id ? "" : quote.id)}
          >
            Request clarification
          </button>
          <button
            className="outline"
            disabled={current.expired}
            onClick={() => setConfirm(quote.id)}
          >
            Select quote
          </button>
        </div>
        {confirm === quote.id && (
          <div className="record quote-stack">
            <p>
              Record this demo choice?{" "}
              {[
                ...current.warnings,
                current.completeness === "Fully quoted"
                  ? ""
                  : current.completeness,
              ]
                .filter(Boolean)
                .join(". ")}
            </p>
            <div className="actions">
              <button className="button" onClick={() => decide(quote)}>
                Confirm quote choice
              </button>
              <button className="outline" onClick={() => setConfirm("")}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {clarify === quote.id && (
          <form
            className="quote-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const draft = String(
                new FormData(event.currentTarget).get("draft"),
              ).trim();
              if (!draft) return;
              update(request.id, (previous) => ({
                ...previous,
                drafts: { ...previous.drafts, [quote.id]: draft },
              }));
              setFeedback("Clarification saved as a local draft.");
              setClarify("");
            }}
          >
            <label>
              Clarification draft
              <textarea
                name="draft"
                required
                maxLength={1200}
                defaultValue={
                  work.drafts[quote.id] ?? current.questions.join("\n")
                }
              />
            </label>
            <button className="outline">Save local draft</button>
          </form>
        )}
        <div className="actions">
          {quote.supplierId && (
            <Link to={"/sourcing/supplier/" + quote.supplierId}>
              Supplier profile
            </Link>
          )}
          {quote.offerUrl && <Link to={quote.offerUrl}>Original offer</Link>}
        </div>
      </div>
    );
  }

  return (
    <section className="quote-stack">
      <Link to="/account/requirements">Back to requirements</Link>
      <h2>{request.title}</h2>
      <p>
        Demo Mode · Illustrative supplier quotes. Decisions and drafts stay on
        this device.
      </p>
      {request.quoteContext?.specifications && (
        <p>{request.quoteContext.specifications}</p>
      )}
      {request.quoteContext?.budget !== undefined && (
        <p>
          Budget{" "}
          {new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: request.quoteContext.budgetCurrency ?? "INR",
          }).format(request.quoteContext.budget)}
        </p>
      )}
      <p>
        {context.quantity ?? "Quantity needed"} units ·{" "}
        {context.destination || "Destination needed"} ·{" "}
        {context.deadline ? "Due " + context.deadline : "No deadline"}
        {context.custom && " · Customisation required"}
      </p>
      <details className="record">
        <summary>Set comparison details</summary>
        <form className="quote-context" onSubmit={saveContext}>
          <label>
            Requested quantity
            <input
              type="number"
              min="1"
              max="1000000"
              name="quantity"
              required
              defaultValue={context.quantity}
            />
          </label>
          <label>
            Delivery destination
            <input
              name="destination"
              required
              maxLength={100}
              defaultValue={context.destination}
            />
          </label>
          <label>
            Requested delivery date
            <input
              type="date"
              name="deadline"
              defaultValue={context.deadline}
            />
          </label>
          <label>
            <input
              type="checkbox"
              name="custom"
              defaultChecked={context.custom}
            />{" "}
            Customisation required
          </label>
          <button className="outline">Apply comparison details</button>
        </form>
      </details>
      {latestQuote && (
        <p className="record">
          Selected quote: {latestQuote.supplier} · Revision {latest?.revision}
        </p>
      )}
      {latestQuote && latestQuote.revision !== latest?.revision && (
        <p>
          A newer quote revision is available. Review its terms before recording
          a new choice.
        </p>
      )}
      {work.decisions.length > 0 && (
        <details className="record">
          <summary>Decision history</summary>
          <ul>
            {work.decisions.map((entry, index) => (
              <li key={entry.date + index}>
                {quotes.find((q) => q.id === entry.quoteId)?.supplier ??
                  entry.supplierId}{" "}
                / revision {entry.revision} / {entry.quantity ?? "Unknown"}{" "}
                units / {entry.destination || "Unknown destination"} /{" "}
                {new Date(entry.date).toLocaleString()}
                {entry.warnings.length > 0 && (
                  <p>{entry.warnings.join(". ")}</p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {legacyAction && request.status?.startsWith("Accepted") && (
        <p>{request.status}</p>
      )}
      <p role="status">{feedback}</p>
      {!quotes.length && (
        <p>No sample quotations are available for this requirement.</p>
      )}
      {!!quotes.length && (
        <div className="actions">
          <span>{chosen.length} of 3 quotes selected</span>
          {compare ? (
            <button className="outline" onClick={() => setCompare(false)}>
              Change quote selection
            </button>
          ) : (
            <button
              className="button"
              disabled={chosen.length < 2}
              onClick={() => setCompare(true)}
            >
              Compare quotes
            </button>
          )}
          {compare && (
            <label>
              <input
                type="checkbox"
                checked={differences}
                onChange={(event) => setDifferences(event.target.checked)}
              />{" "}
              Show differences only
            </label>
          )}
        </div>
      )}
      {compare ? (
        <>
          {new Set(chosen.map((q) => q.currency)).size > 1 && (
            <p>
              These quotes use different currencies. Prices are shown in the
              original currency.
            </p>
          )}
          <SupplierQuoteTable quotes={chosen} rows={rows} actions={actions} differences={differences} heading={q => <>{q.supplier}
                      {eligibleQuotes.includes(q) && (
                        <small className="quote-summary">
                          {minimumTotal !== undefined &&
                            report(q).total === minimumTotal &&
                            "Lowest complete comparable total. "}
                          {shortestEstimate !== undefined &&
                            report(q).estimate === shortestEstimate &&
                            "Earliest quoted estimate."}
                        </small>
                      )}
                      <button
                        className="outline"
                        aria-label={"Remove " + q.supplier}
                        onClick={() => toggle(q.id, "selected")}
                      >
                        Remove
                      </button>
                    </>} />
        </>
      ) : (
        <div className="quote-grid">
          {quotes.map((q) => (
            <article className="record quote-stack" key={q.id}>
              <h3>{q.supplier}</h3>
              <p>
                {q.role} · {q.location}
              </p>
              <p>
                {report(q).eligibility} · {report(q).completeness}
              </p>
              <p>
                {q.currency} · MOQ {q.moq} ·{" "}
                {amount(report(q).unit, q.currency, "Unit price on request")}
              </p>
              <p>
                Production {days(q.lead)} · {report(q).timeline}
              </p>
              <p>
                Shipping{" "}
                {rows.find((row) => row.label === "Shipping")?.value(q)} ·
                Customisation{" "}
                {q.custom === true
                  ? "offered"
                  : q.custom === false
                    ? "unsupported"
                    : "unconfirmed"}
              </p>
              {report(q).warnings.length > 0 && (
                <p>{report(q).warnings.join(" · ")}</p>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={work.selected.includes(q.id)}
                  disabled={chosen.length >= 3 && !work.selected.includes(q.id)}
                  onChange={() => toggle(q.id, "selected")}
                />{" "}
                Compare {q.supplier}
              </label>
              <details>
                <summary>View quoted terms</summary>
                <dl>
                  {rows
                    .filter((row) =>
                      [
                        "Quantity price tiers",
                        "Transit time",
                        "Delivery coverage",
                        "Pickup",
                        "Validity",
                      ].includes(row.label),
                    )
                    .map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{row.value(q)}</dd>
                      </div>
                    ))}
                </dl>
              </details>
              {actions(q)}
              {legacyAction && (
                <div className="actions">
                  <button
                    className="outline"
                    disabled={request.status?.startsWith("Accepted")}
                    onClick={() => decide(q)}
                  >
                    Accept quote
                  </button>
                  <button
                    className="outline"
                    disabled={request.status?.startsWith("Accepted")}
                    onClick={() =>
                      updateActivity(
                        "requirements",
                        request.id,
                        "Rejected · " + q.supplier,
                      )
                    }
                  >
                    Reject quote
                  </button>
                  <Link
                    to={
                      "/account/messages?to=" + encodeURIComponent(q.supplier)
                    }
                  >
                    Send demo counteroffer
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function amount(
  minor: number | undefined,
  currency: string,
  fallback = "Not confirmed",
) {
  return minor === undefined ? fallback : formatMinor(minor, currency);
}
function days(value: number | undefined) {
  return value === undefined
    ? "To be confirmed"
    : value + (value === 1 ? " day" : " days");
}
