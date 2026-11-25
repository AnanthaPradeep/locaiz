import { listings } from "./catalog";
import { searchUrl } from "./saved-search";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMarketSession } from "./market-account";
import { marketClient } from "./market-foundation";
import { Page } from "./page";
import { readRequests } from "./stock/client";
import { useDemo } from "./store";

type Entry = {
  id: string;
  title: string;
  date: string;
  href: string;
  kind: "Searches" | "Requirements" | "Stock & pickup" | "Orders" | "Messages";
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
  ]);
  for (const result of [
    rfqs,
    events,
    orders,
    reservations,
    shortlists,
    quotes,
    pickupAudit,
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
  const entries: Entry[] = [
    ...rfqs.data!.map((row): Entry => ({
      id: "rfq-" + row.id,
      title: row.title,
      date: row.created_at,
      href: "/account/journey?rfq=" + row.id,
      kind: "Requirements",
    })),
    ...events
      .data!.filter((row) => row.kind !== "Order confirmed")
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

export default function BuyingTimeline() {
  const session = useMarketSession();
  const [kind, setKind] = useState("");
  const [count, setCount] = useState(20);
  const saved = useDemo((state) => state.savedSearches);
  const demoRequirements = useDemo((state) => state.requirements);
  const user = session?.user.id;
  const connected = useQuery({
    queryKey: ["market", "buying-timeline", user],
    enabled: Boolean(user),
    queryFn: () => connectedEntries(user!),
    refetchInterval: 15000,
  });
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
      title="My Buying Journey"
      intro="Find your buying activity and pick up where you left off."
    >
      <nav className="panel-nav" aria-label="Buying activity">
        {links.map(([label, href]) => (
          <Link key={href} to={href}>
            {label}
          </Link>
        ))}
        {marketClient && (
          <>
            <Link to="/account/journey">Live buyer workspace</Link>
            <Link to="/account/bulk-buying">Bulk buying</Link>
          </>
        )}
      </nav>
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
                  {new Date(row.date).toLocaleString()}
                </time>{" "}
                · {row.kind}
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
