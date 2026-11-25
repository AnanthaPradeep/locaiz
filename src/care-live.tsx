import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MarketGate, useMarketMutation } from "./market-account";
import { formText, marketClient, readMarketContext } from "./market-foundation";
import { formatMinor } from "./sourcing/catalog";

const categories = ["Repair", "Installation", "Maintenance", "Consultation"];
type Service = {
  id: string;
  business_id: string;
  title: string;
  category: string;
  coverage: string;
  description: string;
  estimate_minor: number | null;
  currency: string;
  sourcing_businesses: { name: string };
};
type Slot = {
  id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  taken: boolean;
};
type Booking = {
  id: string;
  service_id: string;
  slot_id: string;
  buyer_id: string;
  status: string;
  note: string;
  rating: number | null;
  care_slots: Slot | null;
  care_services: { title: string; business_id: string } | null;
};
async function care(command: string, payload: Record<string, unknown>) {
  const { error } = await marketClient!.rpc("care_action", {
    command,
    payload,
  });
  if (error) throw error;
}
const time = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

function PublishService({ business }: { business: string }) {
  const change = useMarketMutation();
  const [id, setId] = useState(() => crypto.randomUUID());
  return (
    <details className="record">
      <summary>Publish service profile</summary>
      <form
        className="journey-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fields = new FormData(form);
          void change.run(async () => {
            await care("publish", {
              ...Object.fromEntries(fields),
              id,
              service: business,
            });
            setId(crypto.randomUUID());
            form.reset();
          }, "Service published.");
        }}
      >
        <label>
          Service title
          <input name="title" minLength={3} maxLength={120} required />
        </label>
        <label>
          Service category
          <select name="category">
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Geographic coverage
          <input name="coverage" minLength={2} maxLength={160} required />
        </label>
        <label>
          Service description
          <textarea
            name="description"
            minLength={3}
            maxLength={1500}
            required
          />
        </label>
        <div className="journey-fields">
          <label>
            Indicative price in minor units
            <input name="estimate" type="number" min={0} max={2147483647} />
          </label>
          <label>
            Currency code
            <input
              name="currency"
              pattern="[A-Za-z]{3}"
              defaultValue="INR"
              required
            />
          </label>
        </div>
        <button className="button" disabled={change.pending}>
          Publish service
        </button>
        {change.feedback}
      </form>
    </details>
  );
}

function SlotSelect({
  slots,
  name = "slot",
}: {
  slots: Slot[];
  name?: string;
}) {
  return (
    <label>
      Appointment slot
      <select name={name} required>
        <option value="">Choose an appointment</option>
        {slots.map((slot) => (
          <option key={slot.id} value={slot.id}>
            {time(slot.starts_at)} to {time(slot.ends_at)}
          </option>
        ))}
      </select>
    </label>
  );
}
function ServiceCard({
  service,
  slots,
  member,
  manager,
}: {
  service: Service;
  slots: Slot[];
  member: boolean;
  manager: boolean;
}) {
  const change = useMarketMutation();
  const [id, setId] = useState(() => crypto.randomUUID());
  function submit(
    event: FormEvent<HTMLFormElement>,
    command: "slot" | "request",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    void change.run(
      async () => {
        const details =
          command === "slot"
            ? {
                start: new Date(formText(fields, "start")).toISOString(),
                end: new Date(formText(fields, "end")).toISOString(),
              }
            : Object.fromEntries(fields);
        await care(command, { ...details, id, service: service.id });
        setId(crypto.randomUUID());
        form.reset();
      },
      command === "slot"
        ? "Availability published."
        : "Booking requested. The provider can now respond.",
    );
  }
  return (
    <article className="journey-panel journey-stack">
      <h3>{service.title}</h3>
      <Link to={"/supplier/" + service.business_id}>
        {service.sourcing_businesses?.name ?? "Provider profile"}
      </Link>
      <p>
        {service.category} covered in {service.coverage}
      </p>
      <p className="journey-message">{service.description}</p>
      <p>
        {service.estimate_minor === null
          ? "Estimate after provider assessment"
          : formatMinor(service.estimate_minor, service.currency) +
            " indicative estimate. Final cost depends on assessment."}
      </p>
      {manager && (
        <details>
          <summary>Add appointment availability</summary>
          <form
            className="journey-form"
            onSubmit={(event) => submit(event, "slot")}
          >
            <label>
              Starts at
              <input name="start" type="datetime-local" required />
            </label>
            <label>
              Ends at
              <input name="end" type="datetime-local" required />
            </label>
            <button className="button" disabled={change.pending}>
              Publish appointment slot
            </button>
          </form>
        </details>
      )}
      {!member && slots.length > 0 && (
        <details>
          <summary>Request an appointment</summary>
          <form
            className="journey-form"
            onSubmit={(event) => submit(event, "request")}
          >
            <SlotSelect slots={slots} />
            <label>
              Private note for the provider
              <textarea name="note" maxLength={1000} />
            </label>
            <button className="button" disabled={change.pending}>
              Request booking
            </button>
          </form>
        </details>
      )}
      {!slots.length && <p>No open appointments published.</p>}
      {change.feedback}
    </article>
  );
}
function BookingCard({
  booking,
  slots,
  buyer,
}: {
  booking: Booking;
  slots: Slot[];
  buyer: boolean;
}) {
  const change = useMarketMutation();
  const [messageId, setMessageId] = useState(() => crypto.randomUUID());
  const [expanded, setExpanded] = useState(false);
  const messages = useQuery({
    queryKey: ["market", "care-messages", booking.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("care_messages")
        .select("id,side,body,created_at")
        .eq("booking_id", booking.id)
        .order("id", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data.reverse();
    },
    refetchInterval: 10000,
  });
  const states = !buyer
    ? ((
        {
          requested: ["accepted", "declined"],
          accepted: ["in_service"],
          in_service: ["completed"],
        } as Record<string, string[]>
      )[booking.status] ?? [])
    : [];
  const cancellable = ["requested", "accepted"].includes(booking.status);
  if (cancellable) states.push("cancelled");
  return (
    <article className="journey-panel journey-stack">
      <h3>{booking.care_services?.title ?? "Service booking"}</h3>
      <p>
        {booking.status.replaceAll("_", " ")}
        {booking.care_slots && " at " + time(booking.care_slots.starts_at)}
      </p>
      {booking.note && <p className="journey-message">{booking.note}</p>}
      {states.length > 0 && (
        <div className="actions">
          {states.map((state) => (
            <button
              key={state}
              className="outline"
              disabled={change.pending}
              onClick={() =>
                void change.run(
                  () => care("transition", { id: booking.id, state }),
                  "Booking updated.",
                )
              }
            >
              {
                (
                  {
                    accepted: "Accept booking",
                    declined: "Decline booking",
                    in_service: "Start service",
                    completed: "Complete service",
                    cancelled: "Cancel booking",
                  } as Record<string, string>
                )[state]
              }
            </button>
          ))}
        </div>
      )}
      {buyer && cancellable && slots.length > 0 && (
        <details>
          <summary>Request a new appointment time</summary>
          <form
            className="journey-form"
            onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              void change.run(
                () =>
                  care("reschedule", {
                    id: booking.id,
                    slot: formText(fields, "slot"),
                  }),
                "New time requested. Provider acceptance is required.",
              );
            }}
          >
            <SlotSelect slots={slots} />
            <button className="outline" disabled={change.pending}>
              Request reschedule
            </button>
          </form>
        </details>
      )}
      {buyer &&
        booking.status === "completed" &&
        (booking.rating ? (
          <p>Your completed service rating {booking.rating} out of 5</p>
        ) : (
          <form
            className="journey-form"
            onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              void change.run(
                () =>
                  care("review", {
                    id: booking.id,
                    rating: formText(fields, "rating"),
                  }),
                "Completed service rating saved.",
              );
            }}
          >
            <label>
              Completed service rating
              <select name="rating">
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <button className="outline" disabled={change.pending}>
              Save service rating
            </button>
          </form>
        ))}
      <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>Booking messages</summary>
        {expanded && (
          <>
            {messages.isPending && <p role="status">Loading messages</p>}
            {messages.isError && (
              <p role="alert">
                Unable to load messages.{" "}
                <button
                  className="outline"
                  onClick={() => void messages.refetch()}
                >
                  Retry messages
                </button>
              </p>
            )}
            <ol className="journey-messages">
              {messages.data?.map((message) => (
                <li key={message.id}>
                  <strong>{message.side}</strong> · {time(message.created_at)}
                  <p className="journey-message">{message.body}</p>
                </li>
              ))}
            </ol>
            <form
              className="journey-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const fields = new FormData(form);
                void change.run(async () => {
                  await care("message", {
                    id: booking.id,
                    requestKey: messageId,
                    body: formText(fields, "body"),
                  });
                  setMessageId(crypto.randomUUID());
                  form.reset();
                }, "Message sent.");
              }}
            >
              <label>
                Private message
                <textarea name="body" maxLength={2000} required />
              </label>
              <button className="outline" disabled={change.pending}>
                Send booking message
              </button>
            </form>
          </>
        )}
      </details>
      {change.feedback}
    </article>
  );
}
function CareWorkspace({ user }: { user: string }) {
  const [coverage, setCoverage] = useState("");
  const [category, setCategory] = useState("");
  const [provider, setProvider] = useState("");
  const context = useQuery({
    queryKey: ["market", "context", user],
    queryFn: readMarketContext,
  });
  const rows = useQuery({
    queryKey: ["market", "care", user],
    queryFn: async () => {
      const [service, slot, booking] = await Promise.all([
        marketClient!
          .from("care_services")
          .select(
            "id,business_id,title,category,coverage,description,estimate_minor,currency,sourcing_businesses(name)",
          )
          .limit(80),
        marketClient!
          .from("care_slots")
          .select("id,service_id,starts_at,ends_at,taken")
          .gt("starts_at", new Date().toISOString())
          .eq("taken", false)
          .order("starts_at")
          .limit(200),
        marketClient!
          .from("care_bookings")
          .select(
            "id,service_id,slot_id,buyer_id,status,note,rating,care_slots!care_bookings_slot_id_fkey(starts_at,ends_at),care_services(title,business_id)",
          )
          .order("created_at", { ascending: false })
          .limit(40),
      ]);
      for (const response of [service, slot, booking])
        if (response.error) throw response.error;
      return {
        services: service.data as unknown as Service[],
        slots: slot.data as Slot[],
        bookings: booking.data as unknown as Booking[],
      };
    },
    refetchInterval: 10000,
  });
  const managed =
    context.data?.businesses.filter(
      (item) =>
        ["owner", "manager"].includes(item.role) &&
        item.trust === "verified" &&
        item.type === "Service provider",
    ) ?? [];
  const active = managed.find((item) => item.id === provider) ?? managed[0];
  const services = rows.data?.services.filter(
    (item) =>
      (!category || item.category === category) &&
      item.coverage.toLowerCase().includes(coverage.trim().toLowerCase()),
  );
  const slots = (id: string) =>
    rows.data?.slots.filter((item) => item.service_id === id) ?? [];
  return (
    <div className="journey-stack">
      <Link to="/care">Browse demo Care</Link>
      <Link to="/business/studio">
        Set up a service business in Seller Studio
      </Link>
      {active && (
        <>
          <label>
            Service business
            <select
              value={active.id}
              onChange={(event) => setProvider(event.target.value)}
            >
              {managed.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <PublishService key={active.id} business={active.id} />
        </>
      )}
      <h2>Service providers and availability</h2>
      <div className="journey-fields">
        <label>
          Service coverage
          <input
            type="search"
            value={coverage}
            onChange={(event) => setCoverage(event.target.value)}
          />
        </label>
        <label>
          Service category filter
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      {rows.isPending && <p role="status">Loading services and bookings</p>}
      {rows.isError && (
        <p role="alert">
          Unable to load services.{" "}
          <button className="outline" onClick={() => void rows.refetch()}>
            Retry services
          </button>
        </p>
      )}
      {services?.length === 0 && (
        <p>No service profiles match these filters.</p>
      )}
      {services?.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          slots={slots(service.id)}
          manager={managed.some((item) => item.id === service.business_id)}
          member={
            !context.isSuccess ||
            Boolean(
              context.data.businesses.some(
                (item) => item.id === service.business_id,
              ),
            )
          }
        />
      ))}
      <h2>Booking activity</h2>
      {rows.data?.bookings.length === 0 && <p>No bookings yet.</p>}
      {rows.data?.bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          buyer={booking.buyer_id === user}
          booking={booking}
          slots={slots(booking.service_id)}
        />
      ))}
    </div>
  );
}
export default function CareLive() {
  return (
    <MarketGate title="Care live appointments">
      {(session) => (
        <CareWorkspace key={session.user.id} user={session.user.id} />
      )}
    </MarketGate>
  );
}
