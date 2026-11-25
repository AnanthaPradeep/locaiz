import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMarketMutation } from "../market-account";
import { marketClient } from "../market-foundation";
import type { Assignment, StockRequest } from "./client";

export function PickupPanel({
  request,
  shop,
  seller,
  now,
  refreshed,
}: {
  request: StockRequest;
  shop: Assignment;
  seller: boolean;
  now: number;
  refreshed: () => void;
}) {
  const mutation = useMarketMutation();
  const query = useQuery({
    queryKey: ["market", "pickup", shop.id, seller],
    queryFn: async () => {
      const sku = (table: string, columns: string) =>
        marketClient!
          .from(table)
          .select(columns)
          .eq("shop_id", shop.business_id)
          .eq("product_id", request.product_id)
          .eq("variant", request.variant);
      const [windows, reservations, inventory, supplier] = await Promise.all([
        sku("stock_pickup_windows", "id,starts_at,ends_at,capacity").order(
          "starts_at",
        ),
        marketClient!
          .from("stock_reservations")
          .select("id,status,instructions,quantity,window_id")
          .eq("assignment_id", shop.id)
          .order("created_at", { ascending: false }),
        seller
          ? sku("stock_shop_inventory", "on_hand,enabled").maybeSingle()
          : null,
        seller
          ? null
          : marketClient!
              .from("sourcing_businesses")
              .select("id")
              .eq("pilot_business_id", shop.business_id)
              .eq("published", true)
              .eq("trust_state", "verified")
              .limit(1)
              .maybeSingle(),
      ]);
      for (const result of [windows, reservations, inventory, supplier])
        if (result?.error) throw result.error;
      return {
        windows: windows.data as unknown as {
          id: string;
          starts_at: string;
          ends_at: string;
          capacity: number;
        }[],
        reservations: reservations.data!,
        inventory: inventory?.data as unknown as
          { on_hand: number; enabled: boolean } | undefined,
        supplier: supplier?.data?.id,
      };
    },
    refetchInterval: 15000,
  });
  function run(
    command: string,
    payload: Record<string, unknown>,
    success?: string,
  ) {
    void mutation.run(async () => {
      const { error } = await marketClient!.rpc("pickup_action", {
        command,
        payload: { assignment: shop.id, ...payload },
      });
      if (error) throw error;
      refreshed();
    }, success);
  }
  const data = query.data;
  if (query.isPending) return <p role="status">Loading pickup options</p>;
  if (!data)
    return (
      <p role="alert">
        Pickup options unavailable.{" "}
        <button className="button" onClick={() => void query.refetch()}>
          Retry
        </button>
      </p>
    );
  const valid =
    !request.cancelled_at &&
    Date.parse(request.expires_at) > now &&
    shop.status === "available" &&
    !!shop.available_quantity &&
    (!shop.quote_expires_at || Date.parse(shop.quote_expires_at) > now);
  const windows = data.windows.filter(
    (window) =>
      Date.parse(window.starts_at) > now &&
      (!shop.ready_at ||
        Date.parse(window.starts_at) >= Date.parse(shop.ready_at)),
  );
  const open = data.reservations.some((item) =>
    ["requested", "approved", "ready"].includes(item.status),
  );
  const hasPickup =
    seller || data.reservations.length > 0 || (valid && windows.length > 0);
  return (
    <>
      {!seller && data.supplier && (
        <Link
          to={
            "/account/journey?" +
            new URLSearchParams({
              supplier: data.supplier,
              assignment: shop.id,
            })
          }
        >
          Request a quote from this shop
        </Link>
      )}
      {hasPickup && (
        <details className="journey-panel" open={!seller ? true : undefined}>
          <summary>
            {seller
              ? "Inventory and pickup reservations"
              : "Pickup reservations"}
          </summary>
          {seller && (
            <form
              className="journey-form"
              onSubmit={(event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                run(
                  "inventory",
                  {
                    quantity: fields.get("quantity"),
                    enabled: fields.has("enabled"),
                  },
                  "Inventory saved.",
                );
              }}
            >
              <label>
                Units on hand
                <input
                  type="number"
                  name="quantity"
                  min={0}
                  max={9999}
                  defaultValue={data.inventory?.on_hand ?? 0}
                  required
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={data.inventory?.enabled}
                />{" "}
                Enable pickup reservations for this variant
              </label>
              <button className="button" disabled={mutation.pending}>
                Save inventory
              </button>
            </form>
          )}
          {seller && data.inventory?.enabled && (
            <form
              className="journey-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const fields = new FormData(form);
                run(
                  "window",
                  {
                    start: new Date(String(fields.get("start"))).toISOString(),
                    end: new Date(String(fields.get("end"))).toISOString(),
                    quantity: fields.get("quantity"),
                  },
                  "Pickup window saved.",
                );
              }}
            >
              <div className="journey-fields">
                <label>
                  Window starts
                  <input type="datetime-local" name="start" required />
                </label>
                <label>
                  Window ends
                  <input type="datetime-local" name="end" required />
                </label>
                <label>
                  Window capacity
                  <input
                    type="number"
                    name="quantity"
                    min={1}
                    max={9999}
                    required
                  />
                </label>
              </div>
              <button className="button" disabled={mutation.pending}>
                Add pickup window
              </button>
              <ul>
                {windows.map((window) => (
                  <li key={window.id}>
                    {new Date(window.starts_at).toLocaleString()} · Capacity{" "}
                    {window.capacity}
                  </li>
                ))}
              </ul>
            </form>
          )}
          {!seller && !open && valid && windows.length > 0 && (
            <form
              className="journey-form"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  "reserve",
                  Object.fromEntries(new FormData(event.currentTarget)),
                  "Reservation requested. The shop will review it.",
                );
              }}
            >
              <label>
                Pickup window
                <select name="window" required>
                  {windows.map((window) => (
                    <option key={window.id} value={window.id}>
                      {new Date(window.starts_at).toLocaleString()} to{" "}
                      {new Date(window.ends_at).toLocaleTimeString()}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pickup quantity
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  max={Math.min(
                    request.quantity,
                    shop.available_quantity ?? 0,
                    99,
                  )}
                  defaultValue={1}
                  required
                />
              </label>
              <button className="button" disabled={mutation.pending}>
                Request reservation
              </button>
            </form>
          )}
          {data.reservations.map((item) => {
            const window = data.windows.find(
              (window) => window.id === item.window_id,
            );
            const expired = window && Date.parse(window.ends_at) <= now;
            const states = [];
            if (
              expired &&
              ["requested", "approved", "ready"].includes(item.status)
            )
              states.push("expired");
            else {
              if (seller && item.status === "requested")
                states.push("approved", "declined");
              if (seller && item.status === "approved") states.push("ready");
              if (seller && item.status === "ready") states.push("collected");
              if (
                ["requested", "approved"].includes(item.status) &&
                (!window || Date.parse(window.starts_at) > now)
              )
                states.push("cancelled");
            }
            const labels: Record<string, string> = {
              approved: "Approve",
              declined: "Decline",
              ready: "Mark ready",
              collected: "Mark collected",
              cancelled: "Cancel reservation",
              expired: "Mark expired",
            };
            return (
              <section key={item.id} className="record">
                <h4>Reservation {item.id.slice(0, 8)}</h4>
                <p>
                  {item.quantity} units · {item.status}
                </p>
                {window && (
                  <p>
                    {new Date(window.starts_at).toLocaleString()} to{" "}
                    {new Date(window.ends_at).toLocaleTimeString()}
                  </p>
                )}
                {item.instructions && (
                  <p>Pickup instructions · {item.instructions}</p>
                )}
                {!!states.length && (
                  <form
                    className="journey-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const state = (
                        (event.nativeEvent as SubmitEvent)
                          .submitter as HTMLButtonElement
                      ).value;
                      const instructions = new FormData(
                        event.currentTarget,
                      ).get("instructions");
                      run(
                        "transition",
                        {
                          id: item.id,
                          state,
                          ...(seller ? { instructions } : {}),
                        },
                        "Reservation updated.",
                      );
                    }}
                  >
                    {seller && (
                      <label>
                        Pickup instructions
                        <input
                          type="text"
                          name="instructions"
                          maxLength={500}
                          defaultValue={item.instructions}
                        />
                      </label>
                    )}
                    <div className="journey-actions">
                      {states.map((state) => (
                        <button
                          key={state}
                          className="button"
                          value={state}
                          disabled={mutation.pending}
                        >
                          {labels[state]}
                        </button>
                      ))}
                    </div>
                  </form>
                )}
              </section>
            );
          })}
          {mutation.feedback}
        </details>
      )}
    </>
  );
}
