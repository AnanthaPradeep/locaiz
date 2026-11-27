import { useState, type FormEvent } from "react";
import { useMarketMutation } from "./market-account";
import { marketClient } from "./market-foundation";

export type OrderHandoff = {
  method: "shipping" | "pickup";
  ordered_quantity: number;
  carrier: string | null;
  tracking_number: string | null;
  estimated_delivery: string | null;
  pickup_location: string | null;
  pickup_start: string | null;
  pickup_end: string | null;
  instructions: string;
  created_at: string;
  received_quantity: number | null;
  received_at: string | null;
  receipt_note: string;
};

function localTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium", timeStyle: "short",
  });
}

export function OrderDelivery({ thread, side, method, status, handoff, canHandoff }: {
  thread: string;
  side: "buyer" | "seller";
  method: OrderHandoff["method"];
  status: string;
  handoff?: OrderHandoff | null;
  canHandoff: boolean;
}) {
  const mutation = useMarketMutation();
  const [handoffKey] = useState(() => crypto.randomUUID());
  const [receiptKey] = useState(() => crypto.randomUUID());
  const [received, setReceived] = useState("");
  const canConfirm = side === "buyer" && handoff && handoff.received_quantity === null &&
    (status === "dispatched" || status === "ready");
  const shortageEntry = received !== "" && Number(received) < (handoff?.ordered_quantity ?? 0);

  function submit(event: FormEvent<HTMLFormElement>, command: "handoff" | "receipt") {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const payload = Object.fromEntries(fields);
    void mutation.run(async () => {
      if (command === "handoff" && method === "pickup") {
        const start = new Date(String(payload.pickupStart));
        const end = new Date(String(payload.pickupEnd));
        if (!(end.getTime() > start.getTime())) throw new Error("Pickup end must be after pickup start.");
        payload.pickupStart = start.toISOString();
        payload.pickupEnd = end.toISOString();
      }
      const { error } = await marketClient!.rpc("journey_order_delivery", {
        command,
        payload: { ...payload, thread, requestKey: command === "handoff" ? handoffKey : receiptKey },
      });
      if (error) throw error;
    }, command === "handoff" ? "Delivery handoff recorded." : shortageEntry ? "Shortage reported." : "Receipt confirmed.");
  }

  if (!handoff && !canHandoff) return null;
  return (
    <section className="record journey-stack" aria-label="Delivery and receipt">
      <h4>Delivery and receipt</h4>
      {handoff && (
        <div className="journey-stack">
          {handoff.method === "shipping" ? (
            <>
              <strong>Dispatched</strong>
              <p>Carrier: {handoff.carrier} · Tracking number: {handoff.tracking_number}</p>
              <p>Estimated delivery: {handoff.estimated_delivery}</p>
            </>
          ) : (
            <>
              <strong>Ready for pickup</strong>
              <p>Pickup location: {handoff.pickup_location}</p>
              <p>Pickup window: {localTime(handoff.pickup_start!)} to {localTime(handoff.pickup_end!)} (your local time)</p>
              {handoff.instructions && <p className="journey-message">{handoff.instructions}</p>}
            </>
          )}
          {handoff.received_quantity !== null && (
            <div className="journey-stack">
              <strong>{handoff.received_quantity < handoff.ordered_quantity ? "Shortage reported" : "Receipt confirmed"}</strong>
              <p>Received {handoff.received_quantity} of {handoff.ordered_quantity}
                {handoff.received_quantity < handoff.ordered_quantity &&
                  ` · Missing ${handoff.ordered_quantity - handoff.received_quantity}`}
              </p>
              {handoff.receipt_note && <p className="journey-message">{handoff.receipt_note}</p>}
            </div>
          )}
        </div>
      )}
      {canHandoff && (
        <details>
          <summary>{method === "shipping" ? "Enter shipping details" : "Enter pickup details"}</summary>
          <form className="journey-form" onSubmit={(event) => submit(event, "handoff")}>
            <div className="journey-fields">
              {method === "shipping" ? (
                <>
                  <label>Carrier <input name="carrier" required maxLength={120} /></label>
                  <label>Tracking number <input name="tracking" required maxLength={120} /></label>
                  <label>Estimated delivery <input name="estimatedDelivery" type="date" required /></label>
                </>
              ) : (
                <>
                  <label>Pickup location <input name="location" required maxLength={240} /></label>
                  <label>Pickup starts (local time) <input name="pickupStart" type="datetime-local" required /></label>
                  <label>Pickup ends (local time) <input name="pickupEnd" type="datetime-local" required /></label>
                </>
              )}
            </div>
            {method === "pickup" && <label>Collection instructions <textarea name="instructions" maxLength={1000} /></label>}
            <div className="actions">
              <button className="button" disabled={mutation.pending}>{method === "shipping" ? "Confirm dispatch" : "Confirm ready for pickup"}</button>
            </div>
          </form>
        </details>
      )}
      {canConfirm && (
        <form className="journey-form" onSubmit={(event) => submit(event, "receipt")}>
          <label>Received quantity
            <input name="quantity" type="number" min={0} max={handoff.ordered_quantity} step={1} required
              value={received} onChange={(event) => setReceived(event.target.value)} />
          </label>
          <label>Receipt notes <textarea name="note" maxLength={1000} /></label>
          {shortageEntry && <p>{handoff.ordered_quantity - Number(received)} missing. The order will be marked disputed.</p>}
          <div className="actions">
            <button className="button" disabled={mutation.pending}>{shortageEntry ? "Report a shortage" : "Confirm receipt"}</button>
          </div>
        </form>
      )}
      {mutation.feedback}
    </section>
  );
}
