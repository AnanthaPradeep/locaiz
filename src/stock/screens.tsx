import { PickupPanel } from "./pickup";
import { marketClient } from "../market-foundation";
import { parseIntent } from "../buyer-intent";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import type { Session } from "@supabase/supabase-js";
import { asset, listings } from "../catalog";
import { Page } from "../page";
import {
  readPilot,
  readRequests,
  requestStatus,
  stockClient,
  type Assignment,
  type StockRequest,
} from "./client";
import { pilotId } from "./config";
import "./styles.css";

const time = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const price = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
    amount,
  );
const problem = (error: unknown) =>
  typeof error === "object" && error && "message" in error
    ? String(error.message)
    : "Something went wrong. Please retry.";
const asTimestamp = (value: FormDataEntryValue | null) =>
  value ? new Date(String(value)).toISOString() : null;
const productFor = (id: string) =>
  listings.find((item) => item.section === "shop" && item.id === id);

function StockSession({
  children,
}: {
  children: (session: Session) => ReactNode;
}) {
  const [session, setSession] = useState<Session | null | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const { data } = stockClient!.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await stockClient!.auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (result.error) throw result.error;
    } catch (reason) {
      setError(problem(reason));
    } finally {
      setBusy(false);
    }
  }
  if (session === undefined) return <p role="status">Checking your sign-in…</p>;
  if (!session)
    return (
      <form className="record form" onSubmit={signIn}>
        <h2>Sign in to the stock pilot</h2>
        <p>Use an account issued for the Nagercoil pilot.</p>
        <label>
          Email
          <input type="email" name="email" required autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    );
  return (
    <>
      <div className="actions">
        <span>Signed in as {session.user.email}</span>
        <button
          className="outline"
          onClick={async () => {
            setError("");
            try {
              const result = await stockClient!.auth.signOut({
                scope: "local",
              });
              if (result.error) throw result.error;
            } catch (reason) {
              setError(problem(reason));
            }
          }}
        >
          Sign out
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {children(session)}
    </>
  );
}

export function StockScreen({
  panel,
}: {
  panel: "new" | "buyer" | "seller" | "notifications";
}) {
  const titles = {
    new: "Check Nearby Stock",
    buyer: "My Stock Requests",
    seller: "Stock Requests",
    notifications: "Stock notifications",
  };
  return (
    <Page
      title={titles[panel]}
      label={panel === "seller" ? "LOCAIZ BUSINESS" : "LOCAIZ NEARBY"}
    >
      <nav className="panel-nav" aria-label="Stock navigation">
        <Link to="/nearby">Nearby</Link>
        <Link to="/account/stock">My Stock Requests</Link>
        <Link to="/business/stock">Seller inbox</Link>
        <Link to="/account/stock-notifications">Stock notifications</Link>
      </nav>
      {!stockClient ? (
        <div className="record">
          <p>
            Demo Mode · A Supabase connection is required for authenticated
            stock requests and seller replies.
          </p>
          <Link className="outline" to="/nearby">
            Browse sample shops
          </Link>
        </div>
      ) : (
        <StockSession>
          {(session) =>
            panel === "new" ? (
              <CreateRequest key={session.user.id} />
            ) : (
              <RequestList
                key={`${session.user.id}:${panel}`}
                user={session.user.id}
                seller={panel === "seller"}
                notifications={panel === "notifications"}
              />
            )
          }
        </StockSession>
      )}
    </Page>
  );
}

function CreateRequest() {
  const [params] = useSearchParams();
  const intent = parseIntent(params);
  const product = productFor(params.get("product") || "studio-headphones");
  const variant = params.get("variant") || "Standard";
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submission = useRef<string | undefined>(undefined);
  const locked = useRef(false);
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["stockPilot", pilotId, product?.id, variant],
    queryFn: () => readPilot(product!.id, variant),
    enabled: !!product,
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || !product || !selected.length) return;
    locked.current = true;
    setSaving(true);
    setError("");
    submission.current ??= crypto.randomUUID();
    const form = new FormData(event.currentTarget);
    try {
      const { data, error } = await stockClient!.rpc("create_stock_request", {
        submission: submission.current,
        pilot: pilotId,
        product: product.id,
        selected_variant: variant,
        shops: selected,
        units: Number(form.get("quantity") || 1),
        buyer_note: String(form.get("note") || ""),
        pickup_date: form.get("pickup") || null,
      });
      if (error) throw error;
      navigate(`/account/stock?request=${data}&created=1`, { replace: true });
    } catch (reason) {
      setError(problem(reason));
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  if (!product)
    return (
      <p>
        Product unavailable. <Link to="/shop">Browse products</Link>.
      </p>
    );
  if (query.isPending) return <p role="status">Loading participating shops…</p>;
  if (query.isError) return <Retry onRetry={() => void query.refetch()} />;
  const { pilot, eligible, shops } = query.data;
  return (
    <form className="record form stock-form" onSubmit={submit}>
      <h2>{product.name}</h2>
      <p>Variant {variant}</p>
      <p>
        {pilot?.city} · {pilot?.category}
      </p>
      {!eligible ? (
        <p>
          This product variant is outside the stock pilot.{" "}
          <Link to="/account/stock-new?product=studio-headphones">
            Check eligible headphones
          </Link>
          .
        </p>
      ) : (
        <>
          <fieldset disabled={saving}>
            <legend>Choose up to three shops</legend>
            {shops.length === 0 && (
              <p>No participating shops have been onboarded.</p>
            )}
            {shops.map((shop) => (
              <label key={shop.id} className="stock-choice">
                <input
                  type="checkbox"
                  checked={selected.includes(shop.id)}
                  disabled={!selected.includes(shop.id) && selected.length >= 3}
                  onChange={(event) =>
                    setSelected((previous) =>
                      event.target.checked
                        ? [...previous, shop.id]
                        : previous.filter((id) => id !== shop.id),
                    )
                  }
                />
                {shop.name}
                {shop.is_demo ? " · Pilot test shop" : ""}
              </label>
            ))}
          </fieldset>
          <label>
            Quantity
            <input
              name="quantity"
              type="number"
              min="1"
              max="99"
              defaultValue={intent.quantity && intent.quantity <= 99 ? intent.quantity : 1}
            />
          </label>
          <label>
            Preferred pickup date
            <input name="pickup" type="date" defaultValue={intent.pickupDate} />
          </label>
          <label>
            Message to shops
            <textarea name="note" maxLength={500} rows={3} defaultValue={intent.notes} />
          </label>
          <p>
            Stock replies are informational. An item is only reserved through a
            separate arrangement with the shop.
          </p>
          {error && <p role="alert">{error}</p>}
          <button className="button" disabled={saving || selected.length === 0}>
            {saving ? "Sending…" : "Send stock request"}
          </button>
        </>
      )}
    </form>
  );
}

function Retry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="record">
      <p role="alert">Could not load stock information.</p>
      <button className="outline" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function RequestList({
  user,
  seller,
  notifications,
}: {
  user: string;
  seller: boolean;
  notifications: boolean;
}) {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState("All");
  const [now, setNow] = useState(Date.now);
  const [live, setLive] = useState(false);
  const channelId = useId();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["stockRequests", user, seller],
    queryFn: () => readRequests(user, seller),
    staleTime: 0,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
  const { refetch } = query;
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 15000);
    const reconcile = () => {
      setNow(Date.now());
      void queryClient.invalidateQueries({ queryKey: ["stockRequests", user] });
    };
    const db = stockClient!;
    const channel = db
      .channel(`stock:${user}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stock_feed",
          filter: `user_id=eq.${user}`,
        },
        reconcile,
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") reconcile();
      });
    window.addEventListener("online", reconcile);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", reconcile);
      void db.removeChannel(channel);
    };
  }, [user, channelId, queryClient]);
  if (query.isPending) return <p role="status">Loading stock requests…</p>;
  if (query.isError && !query.data)
    return <Retry onRetry={() => void refetch()} />;
  const selected = params.get("request");
  const refreshed = () => void refetch();
  const entries = query.data ?? [];
  const filtered = entries.filter((item) => !selected || item.id === selected);
  return (
    <>
      <p role="status">
        {live
          ? "Live stock updates connected"
          : "Connecting to live updates · Checking for updates periodically"}
      </p>
      {query.isError && <Retry onRetry={refreshed} />}
      {notifications ? (
        <>
          <h2>Buyer updates</h2>
          <StockNotifications entries={entries} seller={false} now={now} />
          <SellerNotifications user={user} now={now} />
        </>
      ) : (
        <>
          {selected && <Link to="/account/stock">All stock requests</Link>}
          {params.get("created") === "1" && filtered.length > 0 && (
            <p role="status">
              Request sent · {filtered[0].id} · {time(filtered[0].created_at)}
            </p>
          )}
          {seller && (
            <label className="stock-filter">
              Filter requests
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                {["All", "New", "Responded", "Expired"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          {filtered.length === 0 && (
            <p>
              {selected ? "Request unavailable." : "No stock requests yet."}
            </p>
          )}
          <div className="records">
            {filtered.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                seller={seller}
                filter={filter}
                now={now}
                refreshed={refreshed}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function SellerNotifications({ user, now }: { user: string; now: number }) {
  const query = useQuery({
    queryKey: ["stockRequests", user, true],
    queryFn: () => readRequests(user, true),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
  return (
    <>
      <h2>Seller updates</h2>
      {query.isPending ? (
        <p>Loading seller updates…</p>
      ) : query.isError ? (
        <Retry onRetry={() => void query.refetch()} />
      ) : (
        <StockNotifications entries={query.data} seller now={now} />
      )}
    </>
  );
}

function StockNotifications({
  entries,
  seller,
  now,
}: {
  entries: StockRequest[];
  seller: boolean;
  now: number;
}) {
  const assignmentIds = entries.flatMap(request => request.stock_request_shops.map(shop => shop.id));
  const pickup = useQuery({
    queryKey: ["market", "pickup-notifications", seller, assignmentIds],
    enabled: Boolean(marketClient && assignmentIds.length),
    refetchInterval: 15000,
    queryFn: async () => {
      const {data,error} = await marketClient!.from("stock_reservation_audit")
        .select("id,actor,status,created_at,stock_reservations!inner(assignment_id,buyer_id)")
        .in("stock_reservations.assignment_id",assignmentIds).order("id",{ascending:false}).limit(100);
      if (error) throw error;
      return data as unknown as {id:number;actor:string;status:string;created_at:string;stock_reservations:{assignment_id:string;buyer_id:string}}[];
    },
  });
  const requestsByAssignment = new Map(entries.flatMap(request => request.stock_request_shops.map(shop => [shop.id,request.id] as const)));
  const reservationUpdates = (pickup.data ?? [])
    .filter(event => seller ? event.actor === event.stock_reservations.buyer_id : event.actor !== event.stock_reservations.buyer_id)
    .map(event => ({id:requestsByAssignment.get(event.stock_reservations.assignment_id)!,date:event.created_at,text:"Pickup reservation " + event.status}));
  const updates = [...entries.flatMap((request) => [
      ...(seller
        ? [
            {
              id: request.id,
              date: request.created_at,
              text: `New assigned request · ${productFor(request.product_id)?.name ?? request.product_id}`,
            },
          ]
        : []),
      ...request.stock_request_shops
        .filter((shop) => shop.responded_at)
        .map((shop) => ({
          id: request.id,
          date: shop.responded_at!,
          text: `${shop.shop_name} · ${shop.status === "available" ? "Available" : "Out of stock"}`,
        })),
      ...(request.cancelled_at || requestStatus(request, now) === "Expired"
        ? [
            {
              id: request.id,
              date: request.cancelled_at || request.expires_at,
              text: request.cancelled_at
                ? "Request cancelled"
                : "Request expired",
            },
          ]
        : []),
    ])
    , ...reservationUpdates]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return updates.length ? (
    <ul className="record">
      {updates.map((entry, index) => (
        <li key={`${entry.id}:${index}`}>
          <Link
            to={
              seller ? "/business/stock" : `/account/stock?request=${entry.id}`
            }
          >
            {entry.text}
          </Link>{" "}
          · {time(entry.date)}
        </li>
      ))}
    </ul>
  ) : (
    <p>No stock updates yet.</p>
  );
}

function RequestCard({
  request,
  seller,
  now,
  filter,
  refreshed,
}: {
  request: StockRequest;
  seller: boolean;
  now: number;
  filter: string;
  refreshed: () => void;
}) {
  const [message, setMessage] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const product = productFor(request.product_id);
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(request.expires_at) - now) / 60000),
  );
  const closed = Boolean(request.cancelled_at) || !remaining;
  const status = requestStatus(request, now);
  const shops = request.stock_request_shops.filter(
    (shop) =>
      !seller ||
      filter === "All" ||
      (filter === "New" && !closed && shop.status === "pending") ||
      (filter === "Responded" && shop.status !== "pending") ||
      (filter === "Expired" &&
        !request.cancelled_at &&
        !remaining &&
        shop.status === "pending"),
  );
  if (!shops.length) return null;
  return (
    <article className="record stock-card">
      <div className="stock-product">
        {product?.image && (
          <img alt="" src={asset(`images/${product.image}.webp`)} />
        )}
        <div>
          <h2>{product?.name ?? request.product_id}</h2>
          <p>
            {request.variant} · Quantity {request.quantity}
          </p>
        </div>
      </div>
      <p>
        {seller
          ? closed
            ? status
            : `${remaining} min remaining`
          : `${status} · ${shops.length} assigned · ${shops.filter((shop) => shop.status === "pending" && !closed).length} pending`}
      </p>
      <p>
        Created {time(request.created_at)} · Expires {time(request.expires_at)}
      </p>
      {request.preferred_pickup && (
        <p>Preferred pickup {request.preferred_pickup}</p>
      )}
      {request.message && <p>Buyer message · {request.message}</p>}
      {!seller && (
        <Link to={`/account/stock?request=${request.id}`}>Request details</Link>
      )}
      <div className="records">
        {shops.map((shop) => (
          <div key={shop.id} className="record">
            <h3>
              {shop.shop_name}
              {shop.is_demo ? " · Pilot test shop" : ""}
            </h3>
            <p>
              {shop.status === "pending"
                ? request.cancelled_at
                  ? "Cancelled"
                  : closed
                    ? "Expired"
                    : "Pending"
                : shop.status === "available"
                  ? closed || (shop.quote_expires_at && Date.parse(shop.quote_expires_at) <= now)
                    ? "Confirmation expired"
                    : shop.available_quantity !== null && shop.available_quantity < request.quantity
                      ? "Partially available"
                      : "Available"
                  : "Out of stock"}
            </p>
            {shop.responded_at && <p>Replied {time(shop.responded_at)}</p>}
            {shop.price !== null && shop.currency && (
              <p>
                {price(shop.price, shop.currency)} quoted · Stock confirmation
                only
              </p>
            )}
            {shop.available_quantity !== null && (
              <p>{shop.available_quantity} reported available</p>
            )}
            {shop.ready_at && <p>Pickup ready {time(shop.ready_at)}</p>}
            {shop.quote_expires_at && (
              <p>
                Quote valid until {time(shop.quote_expires_at)}
                {Date.parse(shop.quote_expires_at) <= now ? " · Expired" : ""}
              </p>
            )}
            {shop.restock_at && (
              <p>Estimated restock {time(shop.restock_at)}</p>
            )}
            {shop.instructions && (
              <p>Pickup instructions · {shop.instructions}</p>
            )}
            {shop.note && <p>Seller note · {shop.note}</p>}
            {marketClient && <PickupPanel request={request} shop={shop} seller={seller} now={now} refreshed={refreshed} />}
            {seller && !closed && shop.status === "pending" && (
              <div className="actions">
                <Reply shop={shop} available refreshed={refreshed} />
                <Reply shop={shop} available={false} refreshed={refreshed} />
              </div>
            )}
          </div>
        ))}
      </div>
      {!seller && !closed && status !== "All responded" && (
        <button
          className="outline"
          disabled={cancelling}
          onClick={async () => {
            setCancelling(true);
            setMessage("");
            try {
              const { error } = await stockClient!.rpc("cancel_stock_request", {
                request_key: request.id,
              });
              if (error) throw error;
              refreshed();
            } catch (reason) {
              setMessage(problem(reason));
            } finally {
              setCancelling(false);
            }
          }}
        >
          Cancel request
        </button>
      )}
      {message && <p role="alert">{message}</p>}
    </article>
  );
}

function Reply({
  shop,
  available,
  refreshed,
}: {
  shop: Assignment;
  available: boolean;
  refreshed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await stockClient!.rpc("reply_stock_request", {
        assignment: shop.id,
        outcome: available ? "available" : "out_of_stock",
        amount: available ? String(form.get("price")) : null,
        currency_code: available ? "INR" : null,
        pickup_time: asTimestamp(form.get("ready")),
        units: form.get("units") ? Number(form.get("units")) : null,
        pickup_note: form.get("instructions") || null,
        seller_note: form.get("note") || null,
        valid_until: asTimestamp(form.get("valid")),
        restock_time: asTimestamp(form.get("restock")),
      });
      if (error) throw error;
      setOpen(false);
      refreshed();
    } catch (reason) {
      setError(problem(reason));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  const title = available ? "Available" : "Out of stock";
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!saving) {
          setError("");
          setOpen(value);
        }
      }}
    >
      <Dialog.Trigger className="outline">{title}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog stock-dialog">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>
            Reply as {shop.shop_name}. Your reply is final.
          </Dialog.Description>
          <form className="form stock-form" onSubmit={submit}>
            {available ? (
              <>
                <label>
                  Quoted price (INR)
                  <input
                    name="price"
                    type="number"
                    min="0"
                    max="9999999999.99"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Pickup ready time
                  <input name="ready" type="datetime-local" required />
                </label>
                <label>
                  Available quantity
                  <input name="units" type="number" min="1" max="9999" />
                </label>
                <label>
                  Pickup instructions
                  <textarea name="instructions" maxLength={500} />
                </label>
                <label>
                  Quote valid until
                  <input name="valid" type="datetime-local" />
                </label>
              </>
            ) : (
              <label>
                Estimated restock time
                <input name="restock" type="datetime-local" />
              </label>
            )}
            <label>
              Seller note
              <textarea name="note" maxLength={500} />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="actions">
              <button className="button" disabled={saving}>
                Send reply
              </button>
              <Dialog.Close className="outline" disabled={saving}>
                Close
              </Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
