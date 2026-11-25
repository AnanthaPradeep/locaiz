import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MarketGate } from "./market-account";
import { marketClient, readMarketContext } from "./market-foundation";

const metrics = [
  ["productViews", "Signed-in catalogue views"],
  ["enquiries", "Product enquiries"],
  ["rfqs", "RFQs received"],
  ["responseHours", "Average first response (hours)"],
  ["quoteSubmissions", "Quote submissions"],
  ["quoteSelectionRate", "Quote selection rate (%)"],
  ["orders", "Orders created"],
  ["completed", "Completed orders"],
  ["repeatBuyers", "Repeat buyers among completed orders"],
] as const;
type DemandCount = { label: string; requests: number };
type Demand = {
  searchImpressions: number;
  unquotedRequests: number | null;
  pickupConversion: number | null;
  categories: DemandCount[];
  quantities: DemandCount[];
  regions: DemandCount[];
};
function DemandInsights({
  user,
  business,
}: {
  user: string;
  business: string;
}) {
  const query = useQuery({
    queryKey: ["market", "seller-demand", user, business],
    queryFn: async () => {
      const { data, error } = await marketClient!.rpc("seller_demand", {
        business,
      });
      if (error) throw error;
      return data as Demand;
    },
  });
  const current = query.data;
  const format = Intl.NumberFormat();
  return (
    <section
      className="journey-panel market-stack"
      aria-label="Demand insights"
    >
      <h2>Demand insights</h2>
      <p>
        Shows search appearances and interest in your published catalogue.
        Demand groups require at least five distinct buyers.
      </p>
      {query.isPending && <p role="status">Loading demand insights</p>}
      {query.isError && (
        <p role="alert">
          Unable to load demand insights.{" "}
          <button className="outline" onClick={() => void query.refetch()}>
            Retry demand insights
          </button>
        </p>
      )}
      {current && (
        <>
          <dl className="market-grid">
            <div className="record">
              <dt>Signed-in search impressions</dt>
              <dd>{format.format(current.searchImpressions)}</dd>
            </div>
            <div className="record">
              <dt>Unquoted active requests</dt>
              <dd>
                {current.unquotedRequests === null
                  ? "Insufficient data"
                  : format.format(current.unquotedRequests)}
              </dd>
            </div>
            <div className="record">
              <dt>Confirmed stock to collected pickup (%)</dt>
              <dd>
                {current.pickupConversion === null
                  ? "Insufficient data"
                  : format.format(current.pickupConversion)}
              </dd>
            </div>
          </dl>
          <div className="market-grid">
            {(
              [
                ["Requested product categories", current.categories],
                ["Requested quantity ranges", current.quantities],
                ["Destination countries supplied", current.regions],
              ] as const
            ).map(([title, entries]) => (
              <section key={title} className="record">
                <h3>{title}</h3>
                {entries.length ? (
                  <ul>
                    {entries.map((entry) => (
                      <li key={entry.label}>
                        {entry.label} · {format.format(entry.requests)} requests
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Insufficient data</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function Insights({ user }: { user: string }) {
  const [selection, setSelection] = useState("");
  const accounts = useQuery({
    queryKey: ["market", "context", user],
    queryFn: readMarketContext,
  });
  const managed =
    accounts.data?.businesses.filter((item) =>
      ["owner", "manager"].includes(item.role),
    ) ?? [];
  const business = managed.find((item) => item.id === selection) ?? managed[0];
  const insight = useQuery({
    queryKey: ["market", "seller-insights", user, business?.id],
    enabled: Boolean(business),
    queryFn: async () => {
      const { data, error } = await marketClient!.rpc("seller_insights", {
        business: business!.id,
      });
      if (error) throw error;
      return data as Record<(typeof metrics)[number][0], number | null>;
    },
  });
  return (
    <div className="market-stack">
      <Link to="/business/studio">Seller Studio</Link>
      {accounts.isPending && <p role="status">Checking managed businesses</p>}
      {accounts.isError && (
        <p role="alert">
          Unable to verify managed businesses.{" "}
          <button className="outline" onClick={() => void accounts.refetch()}>
            Retry membership check
          </button>
        </p>
      )}
      {accounts.isSuccess && !managed.length && (
        <p>Seller management permissions are required.</p>
      )}
      {business && (
        <section
          className="journey-panel market-stack"
          aria-label="Business activity"
        >
          <label>
            Managed business
            <select
              value={business.id}
              onChange={(event) => setSelection(event.target.value)}
            >
              {managed.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <h2>Last 30 days</h2>
          <p>
            Views count signed-in visitors once per product per hour. Response
            time, selection rate, and repeat buyers require at least five
            qualifying records.
          </p>
          {insight.isPending && <p role="status">Loading activity</p>}
          {insight.isError && (
            <p role="alert">
              Unable to load activity.{" "}
              <button
                className="outline"
                onClick={() => void insight.refetch()}
              >
                Retry activity
              </button>
            </p>
          )}
          {insight.data && (
            <dl className="market-grid">
              {metrics.map(([key, label]) => (
                <div className="record" key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {insight.data[key] === null
                      ? "Insufficient data"
                      : Intl.NumberFormat().format(insight.data[key]!)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
      {business && (
        <DemandInsights key={business.id} user={user} business={business.id} />
      )}
    </div>
  );
}
export default function SellerInsights() {
  return (
    <MarketGate title="Seller insights">
      {(session) => <Insights key={session.user.id} user={session.user.id} />}
    </MarketGate>
  );
}
