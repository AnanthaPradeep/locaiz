import { useState, type FormEvent } from "react";
import { useMarketMutation } from "./market-account";
import { marketClient } from "./market-foundation";
import type { OrderHandoff } from "./order-delivery";

export type Replacement = {
  id: string;
  quantity: number;
  method: "shipping" | "pickup";
  expected_date: string;
  instructions: string;
  proposed_at: string;
  accepted_at: string | null;
  received_at: string | null;
  received_quantity: number | null;
};

function ReplacementActions({ thread, side, outstanding, current, method }: {
  thread: string; side: "buyer" | "seller"; outstanding: number;
  current?: Replacement; method: OrderHandoff["method"];
}) {
  const mutation = useMarketMutation();
  const [requestKey] = useState(() => crypto.randomUUID());

  function act(command: "propose" | "accept" | "receive", event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const fields = event ? Object.fromEntries(new FormData(event.currentTarget)) : {};
    void mutation.run(async () => {
      const { error } = await marketClient!.rpc("journey_order_replacement", {
        command,
        payload: { ...fields, thread, replacement: current?.id, requestKey },
      });
      if (error) throw error;
    }, command === "propose" ? "Replacement proposed." : command === "accept" ? "Replacement accepted." : "Replacement receipt recorded.");
  }

  return (
    <>
      {side === "seller" && !current && (
        <details>
          <summary>Propose replacement</summary>
          <form className="journey-form" onSubmit={(event) => act("propose", event)}>
            <div className="journey-fields">
              <label>Replacement quantity
                <input name="quantity" required type="number" min={1} max={outstanding} step={1} defaultValue={outstanding} />
              </label>
              <label>Replacement method
                <select name="method" defaultValue={method}>
                  <option value="shipping">Shipping</option>
                  <option value="pickup">Pickup</option>
                </select>
              </label>
              <label>Expected replacement date
                <input name="expectedDate" type="date" required min="1900-01-01" max="9999-12-31" />
              </label>
            </div>
            <label>Replacement instructions
              <textarea name="instructions" maxLength={1000} placeholder="Shipping or collection details" />
            </label>
            <div className="actions">
              <button className="button" disabled={mutation.pending}>Send replacement proposal</button>
            </div>
          </form>
        </details>
      )}
      {side === "buyer" && current && !current.accepted_at && (
        <div className="actions">
          <button className="button" disabled={mutation.pending} onClick={() => act("accept")}>Accept replacement</button>
          <button className="outline" type="button" onClick={() => document.getElementById("journey-message-body")?.focus()}>
            Ask about replacement
          </button>
        </div>
      )}
      {side === "buyer" && current?.accepted_at && (
        <form className="journey-form" onSubmit={(event) => act("receive", event)}>
          <label>Replacement quantity received
            <input name="quantity" type="number" required min={0} max={current.quantity} step={1} />
          </label>
          <div className="actions">
            <button className="button" disabled={mutation.pending}>Confirm replacement receipt</button>
          </div>
        </form>
      )}
      {mutation.feedback}
    </>
  );
}

export function ShortageResolution({ thread, side, status, handoff, replacements }: {
  thread: string; side: "buyer" | "seller"; status: string;
  handoff?: OrderHandoff | null; replacements: Replacement[];
}) {
  if (!handoff || handoff.received_quantity === null || handoff.received_quantity >= handoff.ordered_quantity) return null;
  const received = handoff.received_quantity + replacements.reduce((sum, item) => sum + (item.received_quantity ?? 0), 0);
  const outstanding = handoff.ordered_quantity - received;
  const current = replacements.find((item) => item.received_at === null);
  return (
    <section className="record journey-stack" aria-label="Shortage resolution">
      <h4>Shortage resolution</h4>
      <p><strong>{outstanding ? "Outstanding shortage: " + outstanding : "Shortage resolved"}</strong>
        {" · "}Total received {received} of {handoff.ordered_quantity}
      </p>
      {replacements.map((item) => (
        <article key={item.id} className="record journey-stack">
          <h5>{item.received_at ? "Replacement receipt" : item.accepted_at ? "Accepted replacement" : "Replacement proposal"}</h5>
          <p>{item.quantity} units · {item.method === "shipping" ? "Shipping" : "Pickup"} · Expected {item.expected_date}</p>
          {item.instructions && <p className="journey-message">{item.instructions}</p>}
          {item.received_quantity !== null && <p>Received {item.received_quantity} of {item.quantity} replacement units.</p>}
        </article>
      ))}
      {status === "disputed" && outstanding > 0 && (
        <ReplacementActions
          key={current ? current.id + (current.accepted_at ?? "") : replacements.length}
          thread={thread} side={side} outstanding={outstanding} current={current} method={handoff.method}
        />
      )}
    </section>
  );
}
