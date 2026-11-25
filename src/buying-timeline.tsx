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

async function connectedEntries(user: string): Promise<Entry[]> {
  const [rfqs, events, orders, reservations, stock] = await Promise.all([
    marketClient!
      .from("journey_rfqs")
      .select("id,title,created_at")
      .eq("buyer_id", user)
      .order("created_at", { ascending: false })
      .limit(50),
    marketClient!
      .from("journey_events")
      .select("id,thread_id,kind,created_at")
      .eq("recipient_side", "buyer")
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
  ]);
  for (const result of [rfqs, events, orders, reservations])
    if (result.error) throw result.error;
  const rows = reservations.data as unknown as {
    id: string;
    created_at: string;
    stock_request_shops: { request_id: string };
  }[];
  return [
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
      title: "Stock request for " + row.product_id,
      date: row.created_at,
      href: "/account/stock?request=" + row.id,
      kind: "Stock & pickup",
    })),
  ];
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
      ? (connected.data ?? [])
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
          <Link to="/account/journey">Live buyer workspace</Link>
        )}
      </nav>
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
