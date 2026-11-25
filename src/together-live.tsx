import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MarketGate, useMarketMutation } from "./market-account";
import { formText, marketClient, readMarketContext } from "./market-foundation";
import { formatMinor } from "./sourcing/catalog";
import { publishedCatalogue } from "./sourcing/repository";

type Group = {
  id: string;
  business_id: string;
  title: string;
  currency: string;
  unit_minor: number | null;
  minimum: number;
  maximum: number;
  pledged: number;
  closes_at: string;
  state: string;
  tiers: { quantity: number; minor: number }[];
};
async function action(command: string, payload: Record<string, unknown>) {
  const { error } = await marketClient!.rpc("together_action", {
    command,
    payload,
  });
  if (error) throw error;
}

function CreateGroup({ business }: { business: string }) {
  const change = useMarketMutation();
  const [keyword, setKeyword] = useState("");
  const [id, setId] = useState(() => crypto.randomUUID());
  const offers = useQuery({
    queryKey: ["market", "group-offers", business, keyword],
    queryFn: () =>
      publishedCatalogue(marketClient!).offers({
        businessId: business,
        verifiedOnly: true,
        marketplaceOnly: true,
        keyword: keyword || undefined,
      }),
  });
  return (
    <details className="record">
      <summary>Publish a supplier group offer</summary>
      <form
        className="journey-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fields = new FormData(form);
          void change.run(async () => {
            await action("create", {
              id,
              title: formText(fields, "title"),
              offer: formText(fields, "offer"),
              minimum: formText(fields, "minimum"),
              maximum: formText(fields, "maximum"),
              closes: new Date(formText(fields, "closes")).toISOString(),
            });
            setId(crypto.randomUUID());
            form.reset();
          }, "Group offer published.");
        }}
      >
        <label>
          Filter your eligible offers
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
        {offers.isError && (
          <p role="alert">
            Unable to load offers.{" "}
            <button
              type="button"
              className="outline"
              onClick={() => void offers.refetch()}
            >
              Retry offers
            </button>
          </p>
        )}
        {offers.isPending && <p role="status">Loading offers</p>}
        {offers.isSuccess && !offers.data.items.length && (
          <p>No published verified offers match.</p>
        )}
        <label>
          Published offer
          <select name="offer" required>
            <option value="">Select an offer</option>
            {offers.data?.items.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.sourcing_variants.sourcing_products.name} ·{" "}
                {offer.variant_id} · MOQ {offer.minimum_quantity}
              </option>
            ))}
          </select>
        </label>
        <label>
          Group title
          <input name="title" minLength={3} maxLength={120} required />
        </label>
        <div className="journey-fields">
          <label>
            Minimum group quantity
            <input
              name="minimum"
              type="number"
              min={1}
              max={1000000}
              required
            />
          </label>
          <label>
            Maximum group quantity
            <input
              name="maximum"
              type="number"
              min={1}
              max={1000000}
              required
            />
          </label>
          <label>
            Group deadline
            <input name="closes" type="datetime-local" required />
          </label>
        </div>
        <button className="button" disabled={change.pending}>
          Publish group
        </button>
        {change.feedback}
      </form>
    </details>
  );
}

function GroupCard({
  group,
  quantity,
  manager,
  member,
}: {
  group: Group;
  quantity: number;
  manager: boolean;
  member: boolean;
}) {
  const change = useMarketMutation();
  const expired = Date.parse(group.closes_at) <= Date.now();
  const open = group.state === "open" && !expired;
  function run(
    command: string,
    more: Record<string, unknown> = {},
    confirmed?: string,
  ) {
    void change.run(
      () => action(command, { id: group.id, ...more }),
      confirmed,
    );
  }
  return (
    <article className="journey-panel journey-stack">
      <h2>
        <Link to={"/together/group/" + group.id}>{group.title}</Link>
      </h2>
      <Link to={"/supplier/" + group.business_id}>Supplier storefront</Link>
      <p>
        {group.pledged} pledged · {group.minimum} minimum · {group.maximum}{" "}
        maximum
      </p>
      <progress
        aria-label="Progress toward minimum"
        max={group.minimum}
        value={Math.min(group.pledged, group.minimum)}
      />
      <p>
        {group.state === "open" && expired
          ? "Deadline passed"
          : group.state === "accepted"
            ? "Supplier accepted group"
            : group.state}{" "}
        ·{" "}
        <time dateTime={group.closes_at}>
          {new Date(group.closes_at).toLocaleString()}
        </time>
      </p>
      <p>
        {group.currency} ·{" "}
        {group.unit_minor === null
          ? "Unit price on request"
          : formatMinor(group.unit_minor, group.currency) + " listed per unit"}
      </p>
      {!!group.tiers.length && (
        <ul>
          {group.tiers.map((tier) => (
            <li key={tier.quantity}>
              From {tier.quantity} units ·{" "}
              {formatMinor(tier.minor, group.currency)} per unit
            </li>
          ))}
        </ul>
      )}
      <p>
        Supplier acceptance is required before fulfilment. Payments are handled
        separately.
      </p>
      {open && !member && (
        <form
          key={quantity}
          className="journey-form"
          onSubmit={(event) => {
            event.preventDefault();
            const field = new FormData(event.currentTarget);
            run(
              "quantity",
              { quantity: formText(field, "quantity") },
              "Quantity saved.",
            );
          }}
        >
          <label>
            My pledge quantity
            <input
              name="quantity"
              type="number"
              min={1}
              max={group.maximum}
              defaultValue={quantity || 1}
              required
            />
          </label>
          <div className="actions">
            <button className="button" disabled={change.pending}>
              {quantity ? "Update quantity" : "Join group"}
            </button>
            {quantity > 0 && (
              <button
                className="outline"
                type="button"
                disabled={change.pending}
                onClick={() =>
                  run("quantity", { quantity: 0 }, "You left the group.")
                }
              >
                Leave group
              </button>
            )}
          </div>
        </form>
      )}
      {manager && group.state === "open" && (
        <div className="actions">
          {open && group.pledged >= group.minimum && (
            <button
              className="button"
              disabled={change.pending}
              onClick={() => run("accept", {}, "Group accepted by supplier.")}
            >
              Accept group
            </button>
          )}
          <button
            className="outline"
            disabled={change.pending}
            onClick={() => run(expired ? "expire" : "cancel")}
          >
            {expired ? "Mark expired" : "Cancel group"}
          </button>
        </div>
      )}
      {change.feedback}
    </article>
  );
}

function Groups({ user, id }: { user: string; id?: string }) {
  const context = useQuery({
    queryKey: ["market", "context", user],
    queryFn: readMarketContext,
  });
  const data = useQuery({
    queryKey: ["market", "together", user, id],
    queryFn: async () => {
      let groups = marketClient!
        .from("together_groups")
        .select(
          "id,business_id,title,currency,unit_minor,minimum,maximum,pledged,closes_at,state,tiers",
        )
        .order("created_at", { ascending: false })
        .limit(40);
      if (id) groups = groups.eq("id", id);
      const [rows, mine] = await Promise.all([
        groups,
        marketClient!
          .from("together_participation")
          .select("group_id,quantity")
          .eq("buyer_id", user),
      ]);
      if (rows.error) throw rows.error;
      if (mine.error) throw mine.error;
      return {
        rows: rows.data as Group[],
        mine: new Map(mine.data.map((row) => [row.group_id, row.quantity])),
      };
    },
    refetchInterval: 10000,
  });
  const manageable =
    context.data?.businesses.filter(
      (item) =>
        ["owner", "manager"].includes(item.role) && item.trust === "verified",
    ) ?? [];
  const [business, setBusiness] = useState("");
  const selected =
    manageable.find((item) => item.id === business) ?? manageable[0];
  return (
    <div className="journey-stack">
      <Link to={id ? "/together/live" : "/together"}>
        {id ? "Browse live groups" : "Browse demo Together"}
      </Link>
      {!id && selected && (
        <>
          <label>
            Managed business
            <select
              value={selected.id}
              onChange={(event) => setBusiness(event.target.value)}
            >
              {manageable.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <CreateGroup key={selected.id} business={selected.id} />
        </>
      )}
      {data.isPending && <p role="status">Loading groups</p>}
      {data.isError && (
        <p role="alert">
          Unable to load groups.{" "}
          <button className="outline" onClick={() => void data.refetch()}>
            Retry groups
          </button>
        </p>
      )}
      {context.isError && (
        <p role="alert">
          Unable to check business membership.{" "}
          <button className="outline" onClick={() => void context.refetch()}>
            Retry membership check
          </button>
        </p>
      )}
      {data.isSuccess && !data.data.rows.length && (
        <p>
          {id
            ? "Group unavailable."
            : "No supplier groups have been published."}
        </p>
      )}
      {data.data?.rows.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          quantity={data.data.mine.get(group.id) ?? 0}
          manager={manageable.some((item) => item.id === group.business_id)}
          member={
            !context.isSuccess ||
            Boolean(
              context.data.businesses.some(
                (item) => item.id === group.business_id,
              ),
            )
          }
        />
      ))}
    </div>
  );
}
export default function TogetherLive() {
  const { id } = useParams();
  return (
    <MarketGate title="Together live groups">
      {(session) => (
        <Groups
          key={session.user.id + String(id)}
          user={session.user.id}
          id={id}
        />
      )}
    </MarketGate>
  );
}
