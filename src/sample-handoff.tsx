import type { FormEvent } from "react";
import { formatMinor } from "./sourcing/catalog";
import { marketClient } from "./market-foundation";
import { useMarketMutation } from "./market-account";

export type JourneySample = {
  id: string;
  quote_revision: number;
  quantity: number;
  cost_minor: number;
  currency: string;
  lead_days: number;
  delivery: "shipping" | "pickup";
  status: "requested" | "preparing" | "dispatched" | "ready" | "received" | "approved" | "changes_requested";
  feedback: string;
};

export const sampleStatus: Record<JourneySample["status"], string> = {
  requested: "Requested",
  preparing: "Preparing",
  dispatched: "Shipped",
  ready: "Ready for pickup",
  received: "Received",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export function SampleDetails({ sample }: { sample: JourneySample }) {
  return (
    <div className="journey-stack">
      <p>
        {sample.quantity} sample units · Quote revision {sample.quote_revision} ·{" "}
        {formatMinor(sample.cost_minor, sample.currency)} · {sample.lead_days} days ·{" "}
        {sample.delivery === "shipping" ? "Shipping" : "Pickup"}
      </p>
      {sample.feedback && <p className="journey-message">Buyer feedback: {sample.feedback}</p>}
    </div>
  );
}

export function SampleHandoff({
  thread, side, samples, offer,
}: {
  thread: string;
  side: "buyer" | "seller";
  samples: JourneySample[];
  offer?: { id: string; revision: number; currency: string; quantity: string; cost: string; lead: string; delivery: string };
}) {
  const mutation = useMarketMutation();
  const [current, ...history] = samples;
  function act(command: string, payload: Record<string, string | undefined>, success: string) {
    void mutation.run(async () => {
      const { error } = await marketClient!.rpc("journey_sample_action", {
        command,
        payload: { thread, ...payload },
      });
      if (error) throw error;
    }, success);
  }
  function decision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
    const feedback = String(new FormData(event.currentTarget).get("feedback") ?? "").trim();
    act(submitter.value, { sample: current.id, feedback },
      submitter.value === "approved" ? "Sample approved." : "Sample changes requested.");
  }
  const statusAction = side === "seller" && current?.status === "requested"
    ? { command: "preparing", label: "Mark sample preparing" }
    : side === "seller" && current?.status === "preparing"
      ? current.delivery === "shipping"
        ? { command: "dispatched", label: "Mark sample shipped" }
        : { command: "ready", label: "Mark sample ready for pickup" }
      : side === "buyer" && current && ["dispatched", "ready"].includes(current.status)
        ? { command: "received", label: "Mark sample received" }
        : undefined;
  const requestAvailable = side === "buyer" && offer && (!current ||
    (current.status === "changes_requested" && offer.revision > current.quote_revision));
  if (!current && !requestAvailable) return null;
  return (
    <section className="journey-panel journey-stack" aria-label="Sample approval">
      <h3>Sample approval</h3>
      {current && (
        <>
          <p><strong>Sample status: {sampleStatus[current.status]}</strong></p>
          <SampleDetails sample={current} />
        </>
      )}
      {statusAction && (
        <div className="actions">
          <button className="outline" disabled={mutation.pending} onClick={() =>
            act(statusAction.command, { sample: current.id }, "Sample status updated.")
          }>{statusAction.label}</button>
        </div>
      )}
      {side === "buyer" && current?.status === "received" && (
        <form className="journey-form" onSubmit={decision}>
          <label>
            Sample feedback
            <textarea name="feedback" maxLength={1000} placeholder="Required when requesting changes" />
          </label>
          <div className="actions">
            <button className="button" value="approved" disabled={mutation.pending}>Approve sample</button>
            <button className="outline" value="changes_requested" disabled={mutation.pending}>Request sample changes</button>
          </div>
        </form>
      )}
      {current?.status === "changes_requested" && !requestAvailable && (
        <p>{side === "seller"
          ? "Revise the quote to provide updated sample terms."
          : "Waiting for a revised sample quote."}</p>
      )}
      {requestAvailable && (
        <details key={offer.id}>
          <summary>{current ? "Review revised sample terms" : "Review sample request"}</summary>
          <form className="journey-form" onSubmit={(event) => {
            event.preventDefault();
            const delivery = String(new FormData(event.currentTarget).get("delivery") ?? "");
            act("request", { quote: offer.id, delivery }, "Sample requested.");
          }}>
            <p>{offer.quantity} sample units · {formatMinor(Number(offer.cost), offer.currency)} · Lead time {offer.lead} days</p>
            <p>This records a sample request. Sample terms are separate from the bulk order total.</p>
            <label>
              Sample delivery
              <select name="delivery" required defaultValue={
                offer.delivery === "Shipping or pickup" ? "" : offer.delivery.toLowerCase()
              }>
                <option value="">Choose delivery</option>
                {offer.delivery !== "Pickup" && <option value="shipping">Shipping</option>}
                {offer.delivery !== "Shipping" && <option value="pickup">Pickup</option>}
              </select>
            </label>
            <div className="actions">
              <button className="button" disabled={mutation.pending}>Confirm sample request</button>
            </div>
          </form>
        </details>
      )}
      {!!history.length && (
        <details>
          <summary>Previous samples and feedback</summary>
          <div className="journey-stack">
            {history.map((sample) => (
              <article key={sample.id} className="record">
                <h4>{sampleStatus[sample.status]}</h4>
                <SampleDetails sample={sample} />
              </article>
            ))}
          </div>
        </details>
      )}
      {mutation.feedback}
    </section>
  );
}
