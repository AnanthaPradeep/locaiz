import { useLocale } from "./i18n";
import { sourcingDraftSchema, sourcingSpecifications, type SourcingDraft } from "./sourcing-assistant";
import { ReviewPurchase } from "./market-reviews";
import { SupplierQuoteTable } from "./supplier-quote-table";
import { evaluateQuote } from "./quote-evaluation";
import { formatMinor } from "./sourcing/catalog";
import { useEffect, useState, type FormEvent } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { MarketGate, useMarketMutation } from "./market-account";
import { marketClient, validateUpload, verifyFileHeader } from "./market-foundation";

type Side = "buyer" | "seller";
type Terms = Record<
  string,
  string | number | boolean | null | { quantity: number; minor: number }[]
>;
async function action(command: string, payload: Record<string, unknown>) {
  const { data, error } = await marketClient!.rpc("journey_action", {
    command,
    payload,
  });
  if (error) throw error;
  return data as string;
}

async function validateAttachment(file: File) {
  await verifyFileHeader(file, validateUpload(file, true));
}
async function uploadAttachment(path: string, file: File) {
  const { error } = await marketClient!.storage
    .from("journey-private")
    .upload(path, file);
  if (error) {
    const existing = await marketClient!.storage
      .from("journey-private")
      .createSignedUrl(path, 10);
    if (existing.error) throw error;
  }
}
function Requirement({
  user,
  supplier,
  product,
  variant,
  assignment,
  startOpen,
  draft,
  submitted,
}: {
  user: string;
  supplier: string | null;
  product: string | null;
  variant: string | null;
  assignment: string | null;
  startOpen: boolean;
  draft?: SourcingDraft;
  submitted: (id: string) => void;
}) {
  const {t}=useLocale();
  const mutation = useMarketMutation();
  const [submission, setSubmission] = useState(() => crypto.randomUUID());
  const suppliers = useQuery({
    queryKey: ["market", "journey-suppliers"],
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("sourcing_businesses")
        .select("id,name")
        .eq("published", true)
        .eq("trust_state", "verified")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const attachment = fields.get("attachment");
    fields.delete("attachment");
    const file =
      attachment instanceof File && attachment.size > 0
        ? attachment
        : undefined;
    void mutation.run(async () => {
      if (file) await validateAttachment(file);
      const id = await action("submit_rfq", {
        ...Object.fromEntries(fields),
        submission,
        product,
        variant,
        stockAssignment: assignment,
        budget: fields.get("budget") || null,
        businesses: fields.getAll("supplier"),
        custom: fields.has("custom"),
      });
      if (file) {
        const { data, error } = await marketClient!
          .from("journey_threads")
          .select("id")
          .eq("rfq_id", id);
        if (error)
          throw new Error(
            "RFQ sent. Attachment could not be sent. Try again with the same form.",
          );
        try {
          await Promise.all(
            data.map(async (thread) => {
              const path =
                thread.id +
                "/" +
                user +
                "/" +
                submission +
                "." +
                file.type.split("/")[1];
              await uploadAttachment(path, file);
              await action("message", {
                id: thread.id,
                body: "Requirement attachment",
                attachment: path,
                requestKey: submission,
              });
            }),
          );
        } catch {
          throw new Error(
            "RFQ sent. Some attachments could not be sent. Retry the same form to finish sending.",
          );
        }
      }
      setSubmission(crypto.randomUUID());
      form.reset();
      submitted(id);
    }, "Requirement sent.");
  }
  return (
    <details
      className="journey-panel"
      open={supplier || startOpen ? true : undefined}
    >
      <summary>Send a request for quotation</summary>
      <form className="journey-form" onSubmit={submit}>
        <label>
          {t("Requirement title")}
          <input name="title" defaultValue={draft?.description} required minLength={3} maxLength={120} />
        </label>
        <label>
          {t("Specifications")}
          <textarea name="specifications" defaultValue={draft && sourcingSpecifications(draft)} maxLength={3000} />
        </label>
        <label>
          Private requirement attachment
          <input
            type="file"
            name="attachment"
            accept="application/pdf,image/png,image/jpeg,image/webp"
          />
        </label>
        <div className="journey-fields">
          <label>
            {t("Quantity")}
            <input
              name="quantity"
              defaultValue={draft?.quantity ?? undefined}
              type="number"
              min={1}
              max={1000000}
              required
            />
          </label>
          <label>
            Unit
            <select name="unit" defaultValue={draft?.unit || "units"}>
              <option>units</option>
              <option>sets</option>
              <option>pairs</option>
            </select>
          </label>
          <label>
            {t("Destination")}
            <input name="destination" defaultValue={draft?.destination} required minLength={2} maxLength={120} />
          </label>
          <label>
            Required by
            <input name="deadline" type="date" defaultValue={draft?.deadline} />
          </label>
          <label>
            Currency code
            <input
              name="currency"
              defaultValue={draft?.currency || "INR"}
              required
              pattern="[A-Za-z]{3}"
            />
          </label>
          <label>
            Budget in minor units
            <input name="budget" type="number" min={0} defaultValue={draft?.budget && draft.currency ? Math.round(draft.budget * 10 ** (new Intl.NumberFormat("en", {style:"currency",currency:draft.currency}).resolvedOptions().maximumFractionDigits ?? 2)) : undefined} />
          </label>
        </div>
        <label>
          <input type="checkbox" name="custom" defaultChecked={Boolean(draft?.customisation)} /> Custom production required
        </label>
        <fieldset>
          <legend>Invite up to five suppliers</legend>
          {suppliers.isPending && <p>Loading suppliers</p>}
          {suppliers.isError && <p role="alert">Unable to load suppliers.</p>}
          {suppliers.data?.length === 0 && (
            <p>No verified suppliers are accepting requests yet.</p>
          )}
          {suppliers.data
            ?.filter((item) => !assignment || item.id === supplier)
            .map((item) => (
              <label className="journey-choice" key={item.id}>
                <input
                  type="checkbox"
                  name="supplier"
                  value={item.id}
                  defaultChecked={item.id === supplier}
                />{" "}
                {item.name}
              </label>
            ))}
        </fieldset>
        <button
          className="button"
          disabled={mutation.pending || !suppliers.data?.length}
        >
          Send RFQ
        </button>
        {mutation.feedback}
      </form>
    </details>
  );
}

type Quote = {
  id: string;
  revision: number;
  currency: string;
  unit_minor: number;
  moq: number;
  tiers: { quantity: number; minor: number }[];
  shipping_minor: number | null;
  tax_minor: number | null;
  duties_minor: number | null;
  other_minor: number | null;
  production_days: number;
  transit_days: number | null;
  delivery_supported: boolean;
  method: "shipping" | "pickup";
  custom_terms: string;
  expires_at: string;
};
function QuoteEditor({
  id,
  draft,
  current,
  currency,
}: {
  id: string;
  draft?: Terms;
  current?: Quote;
  currency: string;
}) {
  const mutation = useMarketMutation();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const button = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement;
    void mutation.run(
      async () => {
        const tiers = String(fields.get("tierText"))
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const parts = line
              .trim()
              .split(":")
              .map((part) => part.trim());
            if (parts.length !== 2 || parts.some((part) => !/^\d+$/.test(part)))
              throw new Error(
                "Use quantity:price (minor units) for every tier.",
              );
            return { quantity: Number(parts[0]), minor: Number(parts[1]) };
          });
        const terms: Terms = {};
        for (const [key, value] of fields) terms[key] = String(value) || null;
        terms.expires = terms.expires
          ? new Date(String(terms.expires)).toISOString()
          : null;
        await action(button.value, {
          ...terms,
          id,
          supported: fields.has("supported"),
          tiers,
        });
      },
      button.value === "save_quote" ? "Draft saved privately." : "Quote sent.",
    );
  }
  const value = (name: string, fallback?: string | number | null) =>
    String(draft && name in draft ? (draft[name] ?? "") : (fallback ?? ""));
  const expires = value("expires", current?.expires_at);
  const localExpiry = expires
    ? new Date(
        new Date(expires).getTime() -
          new Date(expires).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
  return (
    <details className="journey-panel">
      <summary>{current ? "Revise quote" : "Prepare quote"}</summary>
      <form className="journey-form" onSubmit={submit}>
        <div className="journey-fields">
          <label>
            Currency code
            <input
              name="currency"
              required
              pattern="[A-Za-z]{3}"
              defaultValue={value("currency", current?.currency ?? currency)}
            />
          </label>
          {(
            [
              [
                "unitMinor",
                "Unit price (minor units)",
                current?.unit_minor,
                true,
              ],
              ["moq", "Minimum order quantity", current?.moq, true],
              [
                "shipping",
                "Shipping (minor units)",
                current?.shipping_minor,
                false,
              ],
              ["tax", "Tax (minor units)", current?.tax_minor, false],
              ["duties", "Duties (minor units)", current?.duties_minor, false],
              [
                "other",
                "Other fees (minor units)",
                current?.other_minor,
                false,
              ],
              ["production", "Production days", current?.production_days, true],
              ["transit", "Transit days", current?.transit_days, false],
            ] as const
          ).map(([name, label, fallback, required]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type="number"
                min={name === "moq" ? 1 : 0}
                required={required}
                defaultValue={value(name, fallback)}
              />
            </label>
          ))}
          <label>
            Fulfillment
            <select
              name="method"
              defaultValue={value("method", current?.method ?? "shipping")}
            >
              <option value="shipping">Shipping</option>
              <option value="pickup">Pickup</option>
            </select>
          </label>
          <label>
            Expires
            <input
              name="expires"
              type="datetime-local"
              required
              defaultValue={localExpiry}
            />
          </label>
        </div>
        <label>
          Price tiers (quantity:price per line in minor units)
          <textarea
            name="tierText"
            defaultValue={value(
              "tierText",
              current?.tiers
                .map((tier) => tier.quantity + ":" + tier.minor)
                .join("\n"),
            )}
          />
        </label>
        <label>
          Custom terms
          <textarea
            name="customTerms"
            maxLength={2000}
            defaultValue={value("customTerms", current?.custom_terms)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            name="supported"
            defaultChecked={Boolean(
              draft?.supported ?? current?.delivery_supported,
            )}
          />{" "}
          Can fulfill at the requested destination
        </label>
        <div className="journey-actions">
          <button
            className="button"
            value="save_quote"
            formNoValidate
            disabled={mutation.pending}
          >
            Save draft
          </button>
          <button
            className="button"
            value="submit_quote"
            disabled={mutation.pending}
          >
            {current ? "Send revision" : "Send quote"}
          </button>
        </div>
        {mutation.feedback}
      </form>
    </details>
  );
}

type Thread = {
  id: string;
  rfq_id: string;
  invite_state: string;
  quote_state: string;
  latest_quote: string | null;
  journey_rfqs: {
    title: string;
    specifications: string;
    custom: boolean;
    budget_minor: number | null;
    product_id: string | null;
    variant_id: string | null;
    quantity: number;
    unit: string;
    destination: string;
    deadline: string | null;
    currency: string;
    buyer_id: string;
  };
  sourcing_businesses: { name: string } | null;
};
type JourneyEvent = { id: number; thread_id: string; kind: string };
type Message = {
  id: number;
  side: Side;
  body: string;
  attachment: string | null;
  created_at: string;
};

const price = (amount: number | null, currency: string) =>
  amount === null
    ? "Pending"
    : formatMinor(amount, currency as Parameters<typeof formatMinor>[1]);

function ThreadDetail({
  thread,
  side,
  user,
  notifications,
}: {
  thread: Thread;
  side: Side;
  user: string;
  notifications: JourneyEvent[];
}) {
  const { id, journey_rfqs: requirement } = thread;
  const mutation = useMarketMutation();
  const [attachment, setAttachment] = useState<{
    key: string;
    path: string;
    file: File;
  }>();
  const [messageKey, setMessageKey] = useState(() => crypto.randomUUID());
  const [download, setDownload] = useState<{ path: string; url: string }>();
  const messages = useInfiniteQuery({
    queryKey: ["market", "journey-messages", user, id],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      let query = marketClient!
        .from("journey_messages")
        .select("id,side,body,attachment,created_at")
        .eq("thread_id", id)
        .order("id", { ascending: false })
        .limit(25);
      if (pageParam !== null) query = query.lt("id", pageParam);
      const { data, error } = await query;
      if (error) throw error;
      return data as Message[];
    },
    getNextPageParam: (page) =>
      page.length === 25 ? page.at(-1)?.id : undefined,
    refetchInterval: 15000,
  });
  const details = useQuery({
    queryKey: ["market", "journey-thread", user, id],
    queryFn: async () => {
      const responses = await Promise.all([
        marketClient!
          .from("journey_quote_revisions")
          .select("*")
          .eq("thread_id", id)
          .order("revision", { ascending: false }),
        marketClient!
          .from("journey_quote_drafts")
          .select("terms")
          .eq("thread_id", id)
          .maybeSingle(),
        marketClient!
          .from("journey_orders")
          .select("id,status,terms")
          .eq("thread_id", id)
          .maybeSingle(),
        marketClient!
          .from("journey_shortlists")
          .select("thread_id")
          .eq("thread_id", id)
          .maybeSingle(),
      ]);
      for (const { error } of responses) if (error) throw error;
      const [quotes, draft, order, shortlist] = responses;
      return {
        quotes: quotes.data as Quote[],
        draft: draft.data?.terms as Terms | undefined,
        order: order.data,
        shortlisted: Boolean(shortlist.data),
      };
    },
    refetchInterval: 15000,
  });
  const latest = details.data?.quotes.find(
    (quote) => quote.id === thread.latest_quote,
  );
  const agreedUnit =
    latest?.tiers.reduce<{ quantity: number; minor: number } | undefined>(
      (best, tier) =>
        tier.quantity <= requirement.quantity &&
        (!best || tier.quantity > best.quantity)
          ? tier
          : best,
      undefined,
    )?.minor ?? latest?.unit_minor;
  const order = details.data?.order;
  const actionable =
    latest && new Date(latest.expires_at).getTime() > Date.now() && !order;
  function run(
    command: string,
    payload: Record<string, unknown> = {},
    feedback?: string,
  ) {
    void mutation.run(() => action(command, { id, ...payload }), feedback);
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const file = fields.get("file");
    const command =
      (event.nativeEvent as SubmitEvent).submitter instanceof
        HTMLButtonElement &&
      ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)
        .value === "clarify"
        ? "clarify"
        : "message";
    const body = String(fields.get("body") ?? "").trim();
    void mutation.run(async () => {
      let path: string | undefined;
      if (file instanceof File && file.size > 0) {
        await validateAttachment(file);
        if (
          attachment?.file.name === file.name &&
          attachment.file.size === file.size &&
          attachment.file.lastModified === file.lastModified
        ) {
          path = attachment.path;
        } else {
          path =
            id + "/" + user + "/" + messageKey + "." + file.type.split("/")[1];
          const { error } = await marketClient!.storage
            .from("journey-private")
            .upload(path, file);
          if (error) throw error;
          setAttachment({ path, key: messageKey, file });
        }
      }
      await action(command, {
        id,
        body,
        attachment: path ?? null,
        requestKey:
          attachment?.path === path && attachment ? attachment.key : messageKey,
      });
      setMessageKey(crypto.randomUUID());
      setAttachment(undefined);
      form.reset();
    }, "Message sent.");
  }
  const quoteButton = (command: string, label: string) => (
    <button
      className="button"
      disabled={mutation.pending}
      onClick={() => run(command, { quote: latest?.id })}
    >
      {label}
    </button>
  );
  const nextOrder =
    side === "seller" && order
      ? (
          {
            confirmed: "preparing",
            preparing:
              order.terms.quote.method === "pickup" ? "ready" : "dispatched",
            ready: "completed",
            dispatched: "completed",
          } as Record<string, string>
        )[order.status]
      : undefined;
  return (
    <section className="journey-panel">
      <h2>{requirement.title}</h2>
      <p>
        {thread.sourcing_businesses?.name} · {requirement.quantity}{" "}
        {requirement.unit} · {requirement.destination}
      </p>
      {requirement.product_id && (
        <p>
          <Link to={"/listing/shop/" + requirement.product_id}>
            View requested product
          </Link>
          {requirement.variant_id && " · " + requirement.variant_id}
        </p>
      )}
      {requirement.budget_minor !== null && (
        <p>
          Budget {price(requirement.budget_minor, requirement.currency)} ·{" "}
          {requirement.currency}
        </p>
      )}
      {requirement.custom && <p>Custom production requested</p>}
      {requirement.deadline && <p>Required by {requirement.deadline}</p>}
      {requirement.specifications && (
        <p className="journey-message">{requirement.specifications}</p>
      )}
      <p>
        Invitation {thread.invite_state} · Quote{" "}
        {thread.quote_state.replaceAll("_", " ")}
      </p>
      {notifications.length > 0 && (
        <button
          className="button"
          disabled={mutation.pending}
          onClick={() =>
            run("read", {
              through: Math.max(...notifications.map((event) => event.id)),
            })
          }
        >
          Mark updates as read
        </button>
      )}
      {side === "seller" && thread.invite_state === "invited" && (
        <div className="journey-actions">
          <button
            className="button"
            disabled={mutation.pending}
            onClick={() => run("invite_reply", { state: "accepted" })}
          >
            Accept invitation
          </button>
          <button
            className="button"
            disabled={mutation.pending}
            onClick={() => run("invite_reply", { state: "declined" })}
          >
            Decline invitation
          </button>
        </div>
      )}
      {details.isPending && <p role="status">Loading conversation</p>}
      {details.isError && (
        <p role="alert">
          Unable to load conversation.{" "}
          <button className="button" onClick={() => void details.refetch()}>
            Retry
          </button>
        </p>
      )}
      {details.data && (
        <>
          <h3>Messages</h3>
          {messages.isPending && <p role="status">Loading messages</p>}
          {messages.isError && (
            <p role="alert">
              Unable to load messages.{" "}
              <button
                className="button"
                onClick={() => void messages.refetch()}
              >
                Retry messages
              </button>
            </p>
          )}
          {messages.hasNextPage && (
            <button
              className="button"
              disabled={messages.isFetching}
              onClick={() => void messages.fetchNextPage()}
            >
              Load earlier messages
            </button>
          )}
          <ol className="journey-messages">
            {(messages.data?.pages.flat() ?? []).reverse().map((message) => (
              <li key={message.id}>
                <strong>
                  {message.side === side ? "Your side" : message.side}
                </strong>
                {" · "}
                <time dateTime={message.created_at}>
                  {new Date(message.created_at).toLocaleString()}
                </time>
                <p className="journey-message">{message.body}</p>
                {message.attachment &&
                  (download?.path === message.attachment ? (
                    <a
                      href={download.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open attachment
                    </a>
                  ) : (
                    <button
                      className="button"
                      disabled={mutation.pending}
                      onClick={() =>
                        void mutation.run(async () => {
                          const { data, error } = await marketClient!.storage
                            .from("journey-private")
                            .createSignedUrl(message.attachment!, 60, {
                              download: true,
                            });
                          if (error) throw error;
                          setDownload({
                            path: message.attachment!,
                            url: data.signedUrl,
                          });
                        }, "Attachment link available for one minute.")
                      }
                    >
                      Get private attachment
                    </button>
                  ))}
              </li>
            ))}
          </ol>
          <form className="journey-form" onSubmit={send}>
            <label>
              Message
              <textarea name="body" maxLength={3000} />
            </label>
            <label>
              Private attachment
              <input
                name="file"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
              />
            </label>
            <div className="journey-actions">
              <button className="button" disabled={mutation.pending}>
                Send message
              </button>
              {!order && (side === "seller" || actionable) && (
                <button
                  className="button"
                  value="clarify"
                  disabled={mutation.pending}
                >
                  Ask for clarification
                </button>
              )}
            </div>
          </form>
          {side === "seller" &&
            thread.invite_state === "accepted" &&
            !order && (
              <QuoteEditor
                key={latest?.id ?? id}
                id={id}
                draft={details.data.draft}
                current={latest}
                currency={requirement.currency}
              />
            )}
          {latest && (
            <div className="journey-panel">
              <h3>Quote revisions</h3>
              {details.data.quotes.map((quote) => (
                <details
                  key={quote.id}
                  open={quote.id === latest.id ? true : undefined}
                >
                  <summary>
                    Revision {quote.revision} ·{" "}
                    {price(quote.unit_minor, quote.currency)} per unit ·{" "}
                    {new Date(quote.expires_at).getTime() <= Date.now()
                      ? "Expired"
                      : "Valid until " +
                        new Date(quote.expires_at).toLocaleString()}
                  </summary>
                  <p>
                    Minimum {quote.moq} · {quote.production_days} production
                    days · {quote.transit_days ?? "Pending"} transit days ·{" "}
                    {quote.method}
                  </p>
                  <p>
                    Shipping {price(quote.shipping_minor, quote.currency)} · Tax{" "}
                    {price(quote.tax_minor, quote.currency)} · Duties{" "}
                    {price(quote.duties_minor, quote.currency)} · Other fees{" "}
                    {price(quote.other_minor, quote.currency)}
                  </p>
                  <p>
                    {quote.delivery_supported
                      ? "Destination supported"
                      : "Destination unavailable"}
                  </p>
                  {quote.tiers.map((tier) => (
                    <p key={tier.quantity}>
                      From {tier.quantity} · {price(tier.minor, quote.currency)}{" "}
                      per unit
                    </p>
                  ))}
                  {quote.custom_terms && (
                    <p className="journey-message">{quote.custom_terms}</p>
                  )}
                </details>
              ))}
              <div className="journey-actions">
                {side === "buyer" && (
                  <button
                    className="button"
                    disabled={mutation.pending}
                    onClick={() =>
                      run("shortlist", {
                        state: details.data?.shortlisted ? "remove" : "add",
                      })
                    }
                  >
                    {details.data.shortlisted
                      ? "Remove from shortlist"
                      : "Shortlist quote"}
                  </button>
                )}
                {side === "buyer" &&
                  actionable &&
                  ["submitted", "revised", "under_discussion"].includes(
                    thread.quote_state,
                  ) &&
                  quoteButton("select_quote", "Select quote")}
                {side === "buyer" &&
                  actionable &&
                  [
                    "submitted",
                    "revised",
                    "under_discussion",
                    "selected",
                  ].includes(thread.quote_state) &&
                  quoteButton("decline_quote", "Decline quote")}
                {side === "seller" &&
                  actionable &&
                  thread.quote_state === "selected" &&
                  quoteButton("confirm_terms", "Confirm quoted terms")}
                {side === "seller" &&
                  !order &&
                  !["withdrawn", "declined"].includes(thread.quote_state) &&
                  quoteButton("withdraw_quote", "Withdraw quote")}
              </div>
              {side === "buyer" &&
                actionable &&
                thread.quote_state === "confirmed" && (
                  <details>
                    <summary>Review and create order</summary>
                    <p>
                      Creates an order for {requirement.quantity}{" "}
                      {requirement.unit} using revision {latest.revision}.
                      Payment is handled separately.
                    </p>
                    {agreedUnit !== undefined && (
                      <p>
                        Agreed total{" "}
                        {price(
                          agreedUnit * requirement.quantity +
                            (latest.shipping_minor ?? 0) +
                            (latest.tax_minor ?? 0) +
                            (latest.duties_minor ?? 0) +
                            (latest.other_minor ?? 0),
                          latest.currency,
                        )}{" "}
                        · {latest.currency} · {latest.method} ·{" "}
                        {requirement.destination}
                      </p>
                    )}
                    {quoteButton("create_order", "Confirm and create order")}
                  </details>
                )}
            </div>
          )}
          {order && (
            <div className="journey-panel">
              <h3>Order {order.id.slice(0, 8)}</h3>
              <p>
                {order.status} · {order.terms.quote.method} ·{" "}
                {price(order.terms.totalMinor, order.terms.quote.currency)}
              </p>
              <p>
                Expected by {order.terms.estimatedDate} · Payment status
                unrecorded
              </p>
              {side === "buyer" && order.status === "completed" && <ReviewPurchase order={order.id} product={Boolean(requirement.product_id)} />}
              {side === "buyer" && order.status === "completed" && <Link className="outline" to={"/account/bulk-buying?order=" + order.id}>Start reorder draft</Link>}
              <div className="journey-actions">
                {nextOrder && (
                  <button
                    className="button"
                    disabled={mutation.pending}
                    onClick={() => run("fulfil", { state: nextOrder })}
                  >
                    Mark {nextOrder}
                  </button>
                )}
                {order.status === "confirmed" && (
                  <button
                    className="button"
                    disabled={mutation.pending}
                    onClick={() => run("fulfil", { state: "cancelled" })}
                  >
                    Cancel order
                  </button>
                )}
                {side === "buyer" &&
                  ["preparing", "dispatched", "ready", "completed"].includes(
                    order.status,
                  ) && (
                    <button
                      className="button"
                      disabled={mutation.pending}
                      onClick={() => run("fulfil", { state: "disputed" })}
                    >
                      Open fulfillment dispute
                    </button>
                  )}
              </div>
            </div>
          )}
        </>
      )}
      <details>
        <summary>Report conversation</summary>
        <form
          className="journey-form"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              "report",
              { reason: new FormData(event.currentTarget).get("reason") },
              "Report received.",
            );
          }}
        >
          <label>
            Reason
            <textarea name="reason" minLength={10} maxLength={1000} required />
          </label>
          <button className="button" disabled={mutation.pending}>
            Send report
          </button>
        </form>
      </details>
      {mutation.feedback}
    </section>
  );
}

function Journey({ user, side }: { user: string; side: Side }) {
  const location = useLocation();
  const handoff = sourcingDraftSchema.safeParse(location.state?.sourcingDraft);
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const chosen = params.get("thread");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const channel = marketClient!
      .channel("journey-" + user + "-" + side)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "journey_events" },
        () => {
          void cache.invalidateQueries({ queryKey: ["market"] });
        },
      )
      .subscribe();
    return () => {
      void marketClient!.removeChannel(channel);
    };
  }, [cache, user, side]);
  const list = useQuery({
    queryKey: [
      "market",
      "journey-list",
      user,
      side,
      search,
      page,
      params.get("rfq"),
    ],
    queryFn: async () => {
      let query = marketClient!
        .from("journey_threads")
        .select(
          "id,rfq_id,invite_state,quote_state,latest_quote,sourcing_businesses(name),journey_rfqs!inner(title,specifications,custom,budget_minor,product_id,variant_id,quantity,unit,destination,deadline,currency,buyer_id)",
        )
        .order("updated_at", { ascending: false })
        .order("id")
        .range(page * 20, page * 20 + 19);
      query =
        side === "buyer"
          ? query.eq("journey_rfqs.buyer_id", user)
          : query.neq("journey_rfqs.buyer_id", user);
      if (search) query = query.ilike("journey_rfqs.title", "%" + search + "%");
      const rfq = params.get("rfq");
      if (rfq) query = query.eq("rfq_id", rfq);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Thread[];
    },
    refetchInterval: 15000,
  });
  const updates = useQuery({
    queryKey: ["market", "journey-updates", user, side],
    queryFn: async () => {
      const [events, reads] = await Promise.all([
        marketClient!
          .from("journey_events")
          .select("id,thread_id,kind")
          .eq("recipient_side", side)
          .order("id", { ascending: false })
          .limit(100),
        marketClient!
          .from("journey_reads")
          .select("thread_id,through_event")
          .eq("user_id", user),
      ]);
      if (events.error) throw events.error;
      if (reads.error) throw reads.error;
      const read = new Map(
        reads.data.map((row) => [row.thread_id, Number(row.through_event)]),
      );
      return (events.data as JourneyEvent[]).filter(
        (event) => event.id > (read.get(event.thread_id) ?? 0),
      );
    },
    refetchInterval: 15000,
  });
  const selected = useQuery({
    queryKey: ["market", "journey-selected", user, side, chosen],
    enabled: Boolean(chosen),
    queryFn: async () => {
      let query = marketClient!
        .from("journey_threads")
        .select(
          "id,rfq_id,invite_state,quote_state,latest_quote,sourcing_businesses(name),journey_rfqs!inner(title,specifications,custom,budget_minor,product_id,variant_id,quantity,unit,destination,deadline,currency,buyer_id)",
        )
        .eq("id", chosen);
      query =
        side === "buyer"
          ? query.eq("journey_rfqs.buyer_id", user)
          : query.neq("journey_rfqs.buyer_id", user);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as unknown as Thread | null;
    },
    refetchInterval: 15000,
  });
  const active = chosen ? selected.data : list.data?.[0];
  return (
    <div className="journey-stack">
      {side === "buyer" && <Link to="/account/buying-journey">My Buying Journey</Link>}
      {side === "buyer" && (
        <Requirement
          key={[
            params.get("supplier"),
            params.get("product"),
            params.get("variant"),
            params.get("assignment"),
            params.get("new"),
          ].join(":")}
          user={user}
          supplier={params.get("supplier")}
          product={params.get("product")}
          variant={params.get("variant")}
          assignment={params.get("assignment")}
          startOpen={params.has("new")}
          draft={handoff.success ? handoff.data : undefined}
          submitted={(id) => {
            setPage(0);
            setSearch("");
            setParams({ rfq: id });
          }}
        />
      )}
      <div className="journey-layout">
        <aside className="journey-panel journey-stack">
          <h2>Conversations</h2>
          <label>
            Find by requirement
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          {params.has("rfq") && (
            <Link to="/account/journey" onClick={() => setPage(0)}>
              Show all requirements
            </Link>
          )}
          {list.isError && <p role="alert">Unable to load conversations.</p>}
          {list.isPending && <p role="status">Loading conversations</p>}
          {list.data?.length === 0 && <p>No conversations match.</p>}
          {list.data?.map((thread) => (
            <Link
              key={thread.id}
              aria-current={active?.id === thread.id ? "true" : undefined}
              to={
                "?" +
                new URLSearchParams({
                  ...Object.fromEntries(params),
                  thread: thread.id,
                })
              }
            >
              {thread.journey_rfqs.title} ·{" "}
              {thread.sourcing_businesses?.name ?? "Supplier"}
            </Link>
          ))}
          <div className="journey-actions">
            {page > 0 && (
              <button className="button" onClick={() => setPage(page - 1)}>
                Previous
              </button>
            )}
            {list.data?.length === 20 && (
              <button className="button" onClick={() => setPage(page + 1)}>
                Next
              </button>
            )}
          </div>
          <h3>Unread updates</h3>
          {updates.isError && <p role="alert">Unable to load updates.</p>}
          {updates.data?.length === 0 && <p>You are up to date.</p>}
          {updates.data?.slice(0, 10).map((update) => (
            <Link key={update.id} to={"?thread=" + update.thread_id}>
              {update.kind}
            </Link>
          ))}
        </aside>
        <div className="journey-stack">
          {chosen && selected.isPending && (
            <p role="status">Loading conversation</p>
          )}
          {chosen && (selected.isError || selected.data === null) && (
            <p role="alert">Conversation unavailable.</p>
          )}
          {active && side === "buyer" && (
            <LiveComparison user={user} thread={active} />
          )}
          {active && (
            <ThreadDetail
              key={active.id}
              thread={active}
              user={user}
              side={side}
              notifications={
                updates.data?.filter(
                  (event) => event.thread_id === active.id,
                ) ?? []
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LiveComparison({ user, thread }: { user: string; thread: Thread }) {
  const [params] = useSearchParams();
  const [open, setOpen] = useState(params.get("compare") === "1");
  const [differences, setDifferences] = useState(false);
  const requirement = thread.journey_rfqs;
  const quotes = useQuery({
    queryKey: ["market", "journey-compare", user, thread.rfq_id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("journey_threads")
        .select(
          "id,quote_state,sourcing_businesses(name),quote:journey_quote_revisions!journey_threads_latest_quote_fkey(*)",
        )
        .eq("rfq_id", thread.rfq_id)
        .not("latest_quote", "is", null);
      if (error) throw error;
      return data as unknown as {
        id: string;
        quote_state: string;
        sourcing_businesses: { name: string } | null;
        quote: Quote;
      }[];
    },
    refetchInterval: 15000,
  });
  const now = new Date();
  const rows =
    quotes.data?.map((item) => {
      const quote = item.quote;
      const fee = (amount: number | null) => amount ?? ("pending" as const);
      const report = evaluateQuote(
        {
          id: quote.id,
          revision: quote.revision,
          supplier: item.sourcing_businesses?.name ?? "Supplier",
          location: requirement.destination,
          role: "Supplier",
          currency: quote.currency,
          moq: quote.moq,
          unit: requirement.unit,
          tiers: [
            { quantity: quote.moq, minor: quote.unit_minor },
            ...quote.tiers,
          ].reverse(),
          destinations: quote.delivery_supported
            ? [requirement.destination]
            : [],
          fees: {
            Shipping: fee(quote.shipping_minor),
            Tax: fee(quote.tax_minor),
            Duties: fee(quote.duties_minor),
            Other: fee(quote.other_minor),
            Packaging: quote.other_minor === null ? "pending" : "included",
            Insurance: quote.other_minor === null ? "pending" : "included",
          },
          lead: quote.production_days,
          transit:
            quote.transit_days ?? (quote.method === "pickup" ? 0 : undefined),
          custom: Boolean(quote.custom_terms.trim()),
          validUntil: quote.expires_at,
        },
        {
          quantity: requirement.quantity,
          unit: requirement.unit,
          destination: requirement.destination,
          deadline: requirement.deadline ?? undefined,
          custom: requirement.custom,
        },
        now,
      );
      return { ...item, report };
    }) ?? [];
  const cells: {
    label: string;
    value: (item: (typeof rows)[number]) => string;
  }[] = [
    { label: "Revision", value: ({ quote }) => String(quote.revision) },
    {
      label: "Quote status",
      value: ({ quote_state, report }) =>
        report.expired ? "Expired" : quote_state.replaceAll("_", " "),
    },
    { label: "Currency", value: ({ quote }) => quote.currency },
    {
      label: "Minimum order quantity",
      value: ({ quote }) => String(quote.moq),
    },
    {
      label: "Unit price at requested quantity",
      value: ({ report, quote }) => price(report.unit ?? null, quote.currency),
    },
    {
      label: "Items subtotal",
      value: ({ report, quote }) =>
        price(report.subtotal ?? null, quote.currency),
    },
    {
      label: "Shipping",
      value: ({ quote }) => price(quote.shipping_minor, quote.currency),
    },
    {
      label: "Tax",
      value: ({ quote }) => price(quote.tax_minor, quote.currency),
    },
    {
      label: "Duties",
      value: ({ quote }) => price(quote.duties_minor, quote.currency),
    },
    {
      label: "Other applicable charges",
      value: ({ quote }) => price(quote.other_minor, quote.currency),
    },
    {
      label: "Total",
      value: ({ report, quote }) => price(report.total ?? null, quote.currency),
    },
    { label: "Fulfillment", value: ({ quote }) => quote.method },
    {
      label: "Quoted estimate",
      value: ({ report }) =>
        report.estimate === undefined ? "Pending" : report.estimate + " days",
    },
    { label: "Deadline suitability", value: ({ report }) => report.timeline },
    {
      label: "Custom terms",
      value: ({ quote }) => quote.custom_terms || "Pending",
    },
  ];
  return (
    <details
      className="journey-panel"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Compare supplier quotes</summary>
      {open && (
        <>
          <p>
            {requirement.quantity} {requirement.unit} ·{" "}
            {requirement.destination}. Amounts are shown in the quoted currency.
          </p>
          {quotes.isPending && <p role="status">Loading quotes</p>}
          {quotes.isError && <p role="alert">Unable to load comparison.</p>}
          {quotes.isSuccess && !rows.length && (
            <p>Supplier quotes will appear here.</p>
          )}
          {!!rows.length && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={differences}
                  onChange={(event) => setDifferences(event.target.checked)}
                />{" "}
                Show differences only
              </label>
              <SupplierQuoteTable
                quotes={rows}
                rows={cells}
                differences={differences}
                heading={(item) => item.sourcing_businesses?.name ?? "Supplier"}
                actions={(item) => (
                  <Link to={"?thread=" + item.id}>Review quote</Link>
                )}
              />
            </>
          )}
        </>
      )}
    </details>
  );
}

export default function BuyerSellerJourney({
  side = "buyer",
}: {
  side?: Side;
}) {
  return (
    <MarketGate
      title={side === "buyer" ? "Buyer workspace" : "Seller enquiries"}
    >
      {(session) => (
        <Journey
          key={session.user.id + side}
          user={session.user.id}
          side={side}
        />
      )}
    </MarketGate>
  );
}
