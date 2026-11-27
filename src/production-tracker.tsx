import { useState, type FormEvent } from "react";
import { useMarketMutation } from "./market-account";
import { marketClient } from "./market-foundation";

export const productionStages = {
  making: "Making",
  quality_check: "Quality check",
  packed: "Packed",
} as const;

export type ProductionUpdate = {
  id: string;
  revision: number;
  stage: keyof typeof productionStages;
  completed_quantity: number;
  ready_date: string;
  previous_ready_date: string | null;
  date_reason: string;
  note: string;
  created_at: string;
};

function ProductionForm({ thread, quantity, original, current }: {
  thread: string; quantity: number; original: string | null; current?: ProductionUpdate;
}) {
  const mutation = useMarketMutation();
  const [requestKey] = useState(() => crypto.randomUUID());
  const previousDate = current?.ready_date ?? original ?? "";
  const [readyDate, setReadyDate] = useState(previousDate);
  const changedDate = Boolean(previousDate && readyDate && readyDate !== previousDate);
  const stages: ProductionUpdate["stage"][] =
    current?.stage === "making" ? ["making", "quality_check"] :
    current?.stage === "quality_check" ? ["quality_check", "packed"] :
    current?.stage === "packed" ? ["packed"] : ["making"];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void mutation.run(async () => {
      const { error } = await marketClient!.rpc("journey_record_production", {
        payload: {
          ...Object.fromEntries(fields),
          thread,
          requestKey,
          expectedRevision: current?.revision ?? 0,
        },
      });
      if (error) throw error;
    }, "Production update saved.");
  }

  return (
    <details open={current ? true : undefined}>
      <summary>{current ? "Update production" : "Start production tracking"}</summary>
      <form className="journey-form" onSubmit={submit}>
        <div className="journey-fields">
          <label>
            Production stage
            <select name="stage" defaultValue={stages[0]}>
              {stages.map((stage) => <option key={stage} value={stage}>{productionStages[stage]}</option>)}
            </select>
          </label>
          <label>
            Completed quantity
            <input name="completed" type="number" required min={current?.completed_quantity ?? 0} max={quantity}
              step={1} defaultValue={current?.completed_quantity ?? 0} />
          </label>
          <label>
            Estimated ready date
            <input name="readyDate" type="date" min="1900-01-01" max="9999-12-31" required value={readyDate}
              onChange={(event) => setReadyDate(event.target.value)} />
          </label>
        </div>
        {changedDate && (
          <label>Reason for ready-date change
            <input name="dateReason" required maxLength={500} />
          </label>
        )}
        <label>Progress note
          <textarea name="note" rows={2} maxLength={1000} />
        </label>
        <div className="actions">
          <button className="button" disabled={mutation.pending}>Save production update</button>
        </div>
        {mutation.feedback}
      </form>
    </details>
  );
}

function UpdateDetails({ update, quantity }: { update: ProductionUpdate; quantity: number }) {
  return (
    <div className="journey-stack">
      <strong>{productionStages[update.stage]} · {update.completed_quantity} of {quantity} completed</strong>
      <p>Estimated ready {update.ready_date}
        {update.date_reason && ` (previously ${update.previous_ready_date})`}
      </p>
      {update.date_reason && <p className="journey-message">Date change reason: {update.date_reason}</p>}
      {update.note && <p className="journey-message">{update.note}</p>}
    </div>
  );
}

export function ProductionTracker({ thread, quantity, original, updates, editable }: {
  thread: string;
  quantity: number;
  original: string | null;
  updates: ProductionUpdate[];
  editable: boolean;
}) {
  const [current, ...history] = updates;
  return (
    <section className="record journey-stack" aria-label="Bulk production tracker">
      <h4>Bulk production tracker</h4>
      <p>Agreed quantity: {quantity} · Original estimated ready date: {original ?? "Unrecorded"}</p>
      {current ? <UpdateDetails update={current} quantity={quantity} /> : <p>No production updates yet.</p>}
      {!!history.length && (
        <details>
          <summary>Production update history</summary>
          <ol className="journey-messages">
            {history.map((update) => (
              <li key={update.id}>
                <time dateTime={update.created_at}>{new Date(update.created_at).toLocaleString()}</time>
                <UpdateDetails update={update} quantity={quantity} />
              </li>
            ))}
          </ol>
        </details>
      )}
      {editable && <ProductionForm key={current?.id ?? thread} thread={thread} quantity={quantity} original={original} current={current} />}
    </section>
  );
}
