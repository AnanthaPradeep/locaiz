import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { MarketGate, useMarketMutation } from "./market-account";
import { marketClient } from "./market-foundation";
import { formatMinor } from "./sourcing/catalog";
import { publishedCatalogue } from "./sourcing/repository";

type DraftLine = {
  product: string;
  variant: string;
  supplier: string;
  name: string;
  supplierName: string;
  currency: string;
  price: number | null;
  minimum: number;
  quantity: number;
  submission: string;
  tiers: { quantity: number; unit_price_minor: number }[];
};

function BulkDraft({ user }: { user: string }) {
  const [params] = useSearchParams();
  const order = params.get("order");
  const [keyword, setKeyword] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [results, setResults] = useState<{ name: string; id: string }[]>([]);
  const mutation = useMarketMutation();
  const current = useQuery({
    queryKey: ["market", "bulk-order", user, order],
    enabled: Boolean(order),
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("journey_orders")
        .select("business_id,terms")
        .eq("id", order!)
        .eq("buyer_id", user)
        .eq("status", "completed")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const previous = current.data?.terms.requirement as
    { product_id?: string; variant_id?: string; quantity: number } | undefined;
  const offers = useQuery({
    queryKey: [
      "market",
      "bulk-offers",
      keyword,
      previous?.product_id,
      previous?.variant_id,
      current.data?.business_id,
    ],
    enabled: Boolean(keyword.trim().length >= 2 || previous?.product_id),
    queryFn: () =>
      publishedCatalogue(marketClient!).offers({
        keyword: keyword.trim() || undefined,
        productId: keyword.trim() ? undefined : previous?.product_id,
        variantId: keyword.trim() ? undefined : previous?.variant_id,
        businessId: keyword.trim() ? undefined : current.data?.business_id,
        marketplaceOnly: true,
        verifiedOnly: true,
        includeTiers: true,
      }),
  });
  type Offer = NonNullable<typeof offers.data>["items"][number];
  function add(item: Offer) {
    const line: DraftLine = {
      product: item.product_id,
      variant: item.variant_id,
      supplier: item.sourcing_businesses.id,
      name: item.sourcing_variants.sourcing_products.name,
      supplierName: item.sourcing_businesses.name,
      currency: item.currency,
      price: item.unit_price_minor,
      minimum: item.minimum_quantity,
      tiers: item.sourcing_price_tiers ?? [],
      quantity:
        item.product_id === previous?.product_id &&
        item.variant_id === previous.variant_id
          ? previous.quantity
          : item.minimum_quantity,
      submission: crypto.randomUUID(),
    };
    setLines((existing) =>
      existing.some(
        (row) =>
          row.product === line.product &&
          row.variant === line.variant &&
          row.supplier === line.supplier,
      )
        ? existing
        : [...existing, line],
    );
  }
  const suppliers = [...new Set(lines.map((line) => line.supplier))];
  return (
    <div className="journey-stack">
      <section className="record market-stack">
        <h2>Choose products and variants</h2>
        {order && current.isPending && (
          <p role="status">Loading previous order</p>
        )}
        {order && current.isError && (
          <p role="alert">Unable to load the previous order.</p>
        )}
        {order &&
          current.isSuccess &&
          (previous?.product_id ? (
            <p>
              Previous quantity {previous.quantity}.{" "}
              {Number.isSafeInteger(current.data?.terms.appliedUnitMinor) &&
                current.data?.terms.quote?.currency && (
                  <>
                    Original unit price{" "}
                    {formatMinor(
                      current.data.terms.appliedUnitMinor,
                      current.data.terms.quote.currency,
                    )}
                    .{" "}
                  </>
                )}
              Review current offers, availability, and shipping before ordering
              again.
            </p>
          ) : (
            <p>
              This completed order has no catalogue SKU to copy. Find a product
              to start a new request.
            </p>
          ))}
        <label>
          Search published offers
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
        {offers.isFetching && <p role="status">Checking published offers</p>}
        {offers.isError && <p role="alert">Unable to check current offers.</p>}
        {offers.isSuccess && !offers.data.items.length && (
          <p>No current offers match.</p>
        )}
        {offers.data?.items.map((item) => (
          <article className="record" key={item.id}>
            <h3>{item.sourcing_variants.sourcing_products.name}</h3>
            <p>
              {item.sourcing_businesses.name} · SKU {item.variant_id} · MOQ{" "}
              {item.minimum_quantity}
            </p>
            <p>
              {item.unit_price_minor === null
                ? "Quote required"
                : formatMinor(item.unit_price_minor, item.currency) +
                  " listed per unit"}
            </p>
            <button className="outline" onClick={() => add(item)}>
              Add SKU to quotation basket
            </button>
          </article>
        ))}
      </section>
      <form
        className="journey-form record"
        onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const destination = String(fields.get("destination") ?? "").trim();
          void mutation.run(async () => {
            const failed: string[] = [];
            for (const line of lines) {
              const { data, error } = await marketClient!.rpc(
                "journey_action",
                {
                  command: "submit_rfq",
                  payload: {
                    submission: line.submission,
                    title: line.name,
                    quantity: line.quantity,
                    unit: "units",
                    destination,
                    currency: line.currency,
                    businesses: [line.supplier],
                    product: line.product,
                    variant: line.variant,
                    specifications:
                      "Please confirm current stock, quantity-tier price, shipping charges and delivery terms.",
                  },
                },
              );
              if (error) {
                failed.push(line.name + ": " + error.message);
                continue;
              }
              setResults((existing) => [
                ...existing,
                { id: String(data), name: line.name },
              ]);
              setLines((existing) =>
                existing.filter((item) => item.submission !== line.submission),
              );
            }
            if (failed.length) throw new Error(failed.join(" / "));
          }, "Quotation requests sent.");
        }}
      >
        <h2>Quotation basket</h2>
        {!lines.length && <p>Add SKUs to build your supplier requests.</p>}
        {suppliers.map((supplier) => {
          const group = lines.filter((line) => line.supplier === supplier);
          return (
            <fieldset key={supplier}>
              <legend>{group[0].supplierName}</legend>
              {group.map((line) => {
                const tier = line.tiers
                  .filter((candidate) => candidate.quantity <= line.quantity)
                  .sort((a, b) => b.quantity - a.quantity)[0];
                const listed = tier?.unit_price_minor ?? line.price;
                return (
                  <div className="record" key={line.submission}>
                    <p>
                      {line.name} · {line.variant} · MOQ {line.minimum}
                    </p>
                    <p>
                      {listed === null
                        ? "Current price on request"
                        : formatMinor(listed, line.currency) +
                          " listed per unit"}{" "}
                      · Stock and shipping awaiting supplier confirmation
                    </p>
                    {!!line.tiers.length && (
                      <ul>
                        {line.tiers.map((price) => (
                          <li key={price.quantity}>
                            From {price.quantity} units ·{" "}
                            {formatMinor(price.unit_price_minor, line.currency)}{" "}
                            per unit
                          </li>
                        ))}
                      </ul>
                    )}
                    <label>
                      Quantity for {line.name}
                      <input
                        type="number"
                        min={line.minimum}
                        max={1000000}
                        required
                        value={line.quantity || ""}
                        onChange={(event) =>
                          setLines((existing) =>
                            existing.map((row) =>
                              row.submission === line.submission
                                ? {
                                    ...row,
                                    quantity: Number(event.target.value),
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="outline"
                      onClick={() =>
                        setLines((existing) =>
                          existing.filter(
                            (row) => row.submission !== line.submission,
                          ),
                        )
                      }
                    >
                      Remove {line.name}
                    </button>
                  </div>
                );
              })}
            </fieldset>
          );
        })}
        <label>
          Delivery destination
          <input name="destination" required minLength={2} maxLength={120} />
        </label>
        <p>Each SKU creates a separate request for its supplier.</p>
        <button className="button" disabled={!lines.length || mutation.pending}>
          Send supplier RFQs
        </button>
        {mutation.feedback}
        {results.map((item) => (
          <Link key={item.id} to={"/account/journey?rfq=" + item.id}>
            {item.name} RFQ
          </Link>
        ))}
      </form>
    </div>
  );
}

export default function BulkBuying() {
  return (
    <MarketGate title="Bulk buying">
      {(session) => <BulkDraft key={session.user.id} user={session.user.id} />}
    </MarketGate>
  );
}
