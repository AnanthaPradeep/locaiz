import { commerceLocale, useLocale } from "./i18n";
import { listings } from "./catalog";
import { searchUrl } from "./saved-search";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AccountForm, useMarketSession } from "./market-account";
import { marketClient } from "./market-foundation";
import { Page } from "./page";
import { readRequests } from "./stock/client";
import { useDemo } from "./store";
import { deleteRfqDraft, readRfqDrafts } from "./rfq-drafts";
import { sampleStatus, type JourneySample } from "./sample-handoff";
import { productionStages, type ProductionUpdate } from "./production-tracker";
import type { OrderHandoff } from "./order-delivery";
import type { Replacement } from "./shortage-resolution";
import { SavedDesignLibrary } from "./saved-design-library";
import { savedDesignsHref } from "./saved-designs";

type Entry = {
  id: string;
  title: string;
  date: string;
  href: string;
  description?: string;
  kind: "Searches" | "Requirements" | "Stock & pickup" | "Orders" | "Messages" | "Samples" | "Production" | "Delivery";
};
const links = [
  ["Saved Searches", "/account/saved-searches"],
  ["Wishlist", "/account/wishlist"],
  ["Requirements", "/account/requirements"],
  ["Messages", "/account/messages"],
  ["Orders", "/account/orders"],
  ["Stock requests", "/account/stock"],
] as const;

async function connectedEntries(user: string) {
  const [
    rfqs,
    events,
    orders,
    reservations,
    stock,
    shortlists,
    quotes,
    pickupAudit,
    samples,
    production,
    handoffs,
  ] = await Promise.all([
    marketClient!
      .from("journey_rfqs")
      .select("id,title,created_at")
      .eq("buyer_id", user)
      .order("created_at", { ascending: false })
      .limit(50),
    marketClient!
      .from("journey_events")
      .select("id,thread_id,kind,created_at")
      .or("recipient_side.eq.buyer,actor.eq." + user)
      .order("id", { ascending: false })
      .limit(50),
    marketClient!
      .from("journey_orders")
      .select("id,thread_id,created_at")
      .eq("buyer_id", user)
      .order("created_at", { ascending: false })
      .limit(50),
    marketClient!
      .from("stock_reservations")
      .select("id,created_at,stock_request_shops!inner(request_id)")
      .eq("buyer_id", user)
      .order("created_at", { ascending: false })
      .limit(50),
    readRequests(user, false),
    marketClient!
      .from("journey_shortlists")
      .select("thread_id")
      .eq("buyer_id", user)
      .limit(100),
    marketClient!
      .from("journey_threads")
      .select(
        "id,rfq_id,quote_state,journey_rfqs!inner(title,buyer_id),sourcing_businesses(name)",
      )
      .eq("journey_rfqs.buyer_id", user)
      .not("latest_quote", "is", null)
      .order("updated_at", { ascending: false })
      .limit(100),
    marketClient!
      .from("stock_reservation_audit")
      .select(
        "id,status,created_at,stock_reservations!inner(buyer_id,stock_request_shops!inner(request_id))",
      )
      .eq("stock_reservations.buyer_id", user)
      .neq("status", "requested")
      .order("id", { ascending: false })
      .limit(50),
    marketClient!
      .from("journey_samples")
      .select("id,thread_id,status,updated_at,journey_threads!inner(journey_rfqs!inner(buyer_id,title))")
      .eq("journey_threads.journey_rfqs.buyer_id", user)
      .order("updated_at", { ascending: false })
      .limit(50)
      .overrideTypes<{
        id: string;
        thread_id: string;
        status: JourneySample["status"];
        updated_at: string;
        journey_threads: { journey_rfqs: { title: string } };
      }[], { merge: false }>(),
    marketClient!
      .from("journey_production_updates")
      .select("id,stage,completed_quantity,ready_date,previous_ready_date,date_reason,created_at,journey_orders!inner(thread_id,buyer_id)")
      .eq("journey_orders.buyer_id", user)
      .order("created_at", { ascending: false })
      .limit(50)
      .overrideTypes<(Omit<ProductionUpdate, "note" | "revision"> & { journey_orders: { thread_id: string } })[], { merge: false }>(),
    marketClient!
      .from("journey_order_handoffs")
      .select("order_id,method,ordered_quantity,estimated_delivery,pickup_location,created_at,received_quantity,received_at,journey_orders!inner(thread_id,buyer_id),journey_order_replacements(id,quantity,method,expected_date,proposed_at,accepted_at,received_at,received_quantity)")
      .eq("journey_orders.buyer_id", user)
      .order("created_at", { ascending: false })
      .limit(50)
      .overrideTypes<(Pick<OrderHandoff, "method" | "ordered_quantity" | "estimated_delivery" | "pickup_location" |
        "created_at" | "received_quantity" | "received_at"> & { order_id: string; journey_orders: { thread_id: string };
          journey_order_replacements: Omit<Replacement, "instructions">[] })[], { merge: false }>(),
  ]);
  for (const result of [
    rfqs,
    events,
    orders,
    reservations,
    shortlists,
    quotes,
    pickupAudit,
    samples,
    production,
    handoffs,
  ])
    if (result.error) throw result.error;
  const rows = reservations.data as unknown as {
    id: string;
    created_at: string;
    stock_request_shops: { request_id: string };
  }[];
  const picked = new Set(shortlists.data!.map((row) => row.thread_id));
  const activeQuotes = (
    quotes.data as unknown as {
      id: string;
      rfq_id: string;
      quote_state: string;
      journey_rfqs: { title: string };
      sourcing_businesses: { name: string } | null;
    }[]
  )
    .filter(
      (row) =>
        picked.has(row.id) ||
        ["selected", "confirmed"].includes(row.quote_state),
    )
    .map((row) => ({ ...row, shortlisted: picked.has(row.id) }));
  const pickupEvents = pickupAudit.data as unknown as {
    id: number;
    status: string;
    created_at: string;
    stock_reservations: { stock_request_shops: { request_id: string } };
  }[];
  const trackedHandoffs = new Set(handoffs.data!.map((row) => row.journey_orders.thread_id));
  const entries: Entry[] = [
    ...rfqs.data!.map((row): Entry => ({
      id: "rfq-" + row.id,
      title: row.title,
      date: row.created_at,
      href: "/account/journey?rfq=" + row.id,
      kind: "Requirements",
    })),
    ...events
      .data!.filter((row) => row.kind !== "Order confirmed" && !/^(Sample|Production|Replacement) /.test(row.kind) &&
        !(trackedHandoffs.has(row.thread_id) && ["Order status: ready", "Order status: dispatched"].includes(row.kind)))
      .map((row): Entry => ({
        id: "event-" + row.id,
        title: row.kind,
        date: row.created_at,
        href: "/account/journey?thread=" + row.thread_id,
        kind: row.kind.startsWith("Order status") ? "Orders" : "Messages",
      })),
    ...orders.data!.map((row): Entry => ({
      id: "order-" + row.id,
      title: "Order confirmed",
      date: row.created_at,
      href: "/account/journey?thread=" + row.thread_id,
      kind: "Orders",
    })),
    ...samples.data!.map((row): Entry => ({
      id: "sample-" + row.id,
      title: `Sample ${sampleStatus[row.status].toLowerCase()} · ${row.journey_threads.journey_rfqs.title}`,
      date: row.updated_at,
      href: "/account/journey?thread=" + row.thread_id,
      kind: "Samples",
    })),
    ...production.data!.map((row): Entry => ({
      id: "production-" + row.id,
      title: row.date_reason
        ? row.previous_ready_date && row.ready_date > row.previous_ready_date ? "Production delayed" : "Production ready date revised"
        : "Production update · " + productionStages[row.stage],
      description: `Estimated ready ${row.ready_date}${row.date_reason ? " · " + row.date_reason : ""}`,
      date: row.created_at,
      href: "/account/journey?thread=" + row.journey_orders.thread_id,
      kind: "Production",
    })),
    ...handoffs.data!.flatMap((row): Entry[] => {
      const href = "/account/journey?thread=" + row.journey_orders.thread_id;
      const dispatch: Entry = {
        id: "handoff-" + row.order_id,
        title: row.method === "shipping" ? "Order dispatched" : "Ready for pickup",
        description: row.method === "shipping" ? "Estimated delivery " + row.estimated_delivery : row.pickup_location ?? undefined,
        date: row.created_at,
        href,
        kind: "Delivery",
      };
      if (row.received_quantity === null || !row.received_at) return [dispatch];
      const missing = row.ordered_quantity - row.received_quantity;
      const entries = row.journey_order_replacements.flatMap((item): Entry[] => {
        const proposal: Entry = {
          id: "replacement-proposed-" + item.id,
          title: "Replacement proposed",
          description: `${item.quantity} units · ${item.method === "shipping" ? "Shipping" : "Pickup"} · Expected ${item.expected_date}`,
          date: item.proposed_at,
          href,
          kind: "Delivery",
        };
        if (!item.accepted_at) return [proposal];
        const accepted: Entry = { ...proposal, id: "replacement-accepted-" + item.id,
          title: "Replacement accepted", date: item.accepted_at };
        if (item.received_quantity === null || !item.received_at) return [proposal, accepted];
        return [proposal, accepted, {
          ...proposal,
          id: "replacement-received-" + item.id,
          title: "Replacement received",
          description: `Received ${item.received_quantity} of ${item.quantity} replacement units`,
          date: item.received_at,
        }];
      });
      return [dispatch, {
        id: "receipt-" + row.order_id,
        title: missing ? "Order shortage reported" : "Receipt confirmed",
        description: `Received ${row.received_quantity} of ${row.ordered_quantity}${missing ? " · Missing " + missing : ""}`,
        date: row.received_at,
        href,
        kind: "Delivery",
      }, ...entries];
    }),
    ...rows.map((row): Entry => ({
      id: "reservation-" + row.id,
      title: "Pickup reservation",
      date: row.created_at,
      href: "/account/stock?request=" + row.stock_request_shops.request_id,
      kind: "Stock & pickup",
    })),
    ...stock.map((row): Entry => ({
      id: "stock-" + row.id,
      title:
        "Stock request for " +
        (listings.find((item) => item.id === row.product_id)?.name ??
          row.product_id),
      date: row.created_at,
      href: "/account/stock?request=" + row.id,
      kind: "Stock & pickup",
    })),
    ...stock.flatMap((row) =>
      row.stock_request_shops
        .filter((shop) => shop.responded_at)
        .map((shop): Entry => ({
          id: "stock-reply-" + shop.id,
          title:
            shop.shop_name +
            (shop.status === "available"
              ? " confirmed stock"
              : " reported unavailable stock"),
          date: shop.responded_at!,
          kind: "Stock & pickup",
          href: "/account/stock?request=" + row.id,
        })),
    ),
    ...pickupEvents.map((event): Entry => ({
      id: "pickup-event-" + event.id,
      title: "Pickup reservation " + event.status,
      date: event.created_at,
      kind: "Stock & pickup",
      href:
        "/account/stock?request=" +
        event.stock_reservations.stock_request_shops.request_id,
    })),
  ];
  return { entries, activeQuotes };
}

function RfqDraftList({ user }: { user: string }) {
  const [drafts, setDrafts] = useState(() => readRfqDrafts(user));
  const [feedback, setFeedback] = useState("");
  return (
    <section className="record market-stack" aria-label="RFQ drafts">
      <h2>Drafts</h2>
      {drafts.length === 0 && <p>No saved RFQ drafts on this browser.</p>}
      {drafts.map((draft) => (
        <article className="record market-stack" key={draft.id}>
          <h3>{draft.fields.title?.trim() || "Untitled RFQ"}</h3>
          <time dateTime={new Date(draft.edited).toISOString()}>
            Last edited {new Date(draft.edited).toLocaleString()}
          </time>
          <div className="actions">
            <Link className="button" to={"/account/journey?draft=" + draft.id}>Resume</Link>
            <button className="outline" onClick={() => {
              try {
                deleteRfqDraft(user, draft.id);
                setDrafts(readRfqDrafts(user));
                setFeedback("Draft deleted.");
              } catch {
                setFeedback("Draft could not be deleted on this browser.");
              }
            }}>Delete</button>
          </div>
        </article>
      ))}
      {feedback && <p role="status">{feedback}</p>}
    </section>
  );
}

export default function BuyingTimeline() {
  const {t}=useLocale();
  const session = useMarketSession();
  const [params] = useSearchParams();
  const showDesigns = params.get("view") === "designs";
  const [kind, setKind] = useState("");
  const [count, setCount] = useState(20);
  const saved = useDemo((state) => state.savedSearches);
  const demoRequirements = useDemo((state) => state.requirements);
  const user = session?.user.id;
  const connected = useQuery({
    queryKey: ["market", "buying-timeline", user],
    enabled: Boolean(user) && !showDesigns,
    queryFn: () => connectedEntries(user!),
    refetchInterval: 15000,
  });
  if (showDesigns) {
    return (
      <Page title="Saved Designs" intro="Reuse a saved design in a fresh request for quotation.">
        <Link to="/account/buying-journey">Back to My Buying Journey</Link>
        {user && <SavedDesignLibrary key={user} user={user} />}
        {!marketClient && <p>Saved Designs is available in the connected buyer workspace.</p>}
        {marketClient && session === undefined && <p role="status">Loading your account</p>}
        {marketClient && session === null && <AccountForm />}
      </Page>
    );
  }
  const rows: Entry[] = [
    ...saved.map((row): Entry => ({
      id: "search-" + row.id,
      title: row.name,
      date: row.checked,
      href: searchUrl(row),
      kind: "Searches",
    })),
    ...(marketClient
      ? (connected.data?.entries ?? [])
      : demoRequirements.map((row): Entry => ({
          id: "demo-rfq-" + row.id,
          title: row.title,
          date: row.date,
          href: "/account/quotes?id=" + row.id,
          kind: "Requirements",
        }))),
  ];
  const visible = rows
    .filter((row) => !kind || row.kind === kind)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return (
    <Page
      translateTitle title="My Buying Journey"
      intro="Find your buying activity and pick up where you left off."
    >
      <nav className="panel-nav" aria-label="Buying activity">
        {links.map(([label, href]) => (
          <Link key={href} to={href}>
            {t(label)}
          </Link>
        ))}
        {marketClient && (
          <>
            <Link to="/account/journey">Live buyer workspace</Link>
            <Link to="/account/bulk-buying">Bulk buying</Link>
            <Link to={savedDesignsHref}>Saved Designs</Link>
          </>
        )}
      </nav>
      {user && <RfqDraftList key={user} user={user} />}
      {!!connected.data?.activeQuotes.length && (
        <section
          aria-label="Shortlisted and selected quotes"
          className="record market-stack"
        >
          <h2>Shortlisted and selected quotes</h2>
          {connected.data.activeQuotes.map((quote) => (
            <article key={quote.id} className="record market-stack">
              <h3>
                <Link to={"/account/journey?thread=" + quote.id}>
                  {quote.journey_rfqs.title}
                </Link>
              </h3>
              <p>
                {quote.sourcing_businesses?.name ?? "Supplier"} ·{" "}
                {quote.quote_state.replaceAll("_", " ")}
                {quote.shortlisted ? " · Shortlisted" : ""}
              </p>
              <Link to={"/account/journey?rfq=" + quote.rfq_id + "&compare=1"}>
                Open supplier comparison
              </Link>
            </article>
          ))}
        </section>
      )}
      <section
        className="journey-panel journey-stack"
        aria-labelledby="buying-activity"
      >
        <h2 id="buying-activity">Activity timeline</h2>
        <label>
          Activity type{" "}
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setCount(20);
            }}
          >
            <option value="">All activity</option>
            {[
              "Searches",
              "Requirements",
              "Stock & pickup",
              "Orders",
              ...(marketClient ? ["Samples", "Production", "Delivery"] : []),
              "Messages",
            ].map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
        </label>
        {!marketClient && <p className="muted">Demo Mode activity</p>}
        {marketClient && session === null && (
          <Link to="/account/sign-in">Sign in to view live activity</Link>
        )}
        {marketClient &&
          (session === undefined || Boolean(user && connected.isPending)) && (
            <p role="status">Loading buying activity</p>
          )}
        {connected.isError && (
          <p role="alert">
            Unable to load live activity.{" "}
            <button
              className="outline"
              onClick={() => void connected.refetch()}
            >
              Retry
            </button>
          </p>
        )}
        {!visible.length && (!user || connected.isSuccess) && (
          <p>
            No activity in this view. <Link to="/shop">Browse products</Link>
          </p>
        )}
        {!!visible.length && (
          <ol className="journey-messages">
            {visible.slice(0, count).map((row) => (
              <li key={row.id}>
                <Link to={row.href}>{row.title}</Link>
                <br />
                <time dateTime={row.date}>
                  {new Date(row.date).toLocaleString(commerceLocale())}
                </time>{" "}
                · {row.kind}
                {row.description && <p>{row.description}</p>}
              </li>
            ))}
          </ol>
        )}
        {visible.length > count && (
          <button className="outline" onClick={() => setCount(count + 20)}>
            Show earlier activity
          </button>
        )}
      </section>
    </Page>
  );
}
