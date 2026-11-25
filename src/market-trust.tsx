import { NearbyVerification } from "./connected-nearby";
import { useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { MarketGate, useMarketMutation } from "./market-account";
import {
  formText,
  marketAction,
  marketClient,
  readMarketContext,
  signMarketFile,
} from "./market-foundation";

type QueueEntry = {
  id: string;
  label: string;
  details: string;
  kind: "listing" | "supplier" | "report";
  choices: { value: string; label: string }[];
  evidence?: string | null;
};
async function readQueue() {
  const [products, suppliers, reports, audit] = await Promise.all([
    marketClient!
      .from("sourcing_products")
      .select("id,name,description,publication_state")
      .in("publication_state", ["submitted", "under_review"])
      .order("created_at")
      .limit(50),
    marketClient!
      .from("market_verifications")
      .select("id,summary,evidence_path,state,sourcing_businesses(name)")
      .in("state", ["pending", "verified"])
      .order("created_at", { ascending: false })
      .limit(50),
    marketClient!
      .from("market_reports")
      .select("id,complaint,sourcing_businesses(name)")
      .eq("state", "open")
      .order("created_at")
      .limit(50),
    marketClient!
      .from("market_audit")
      .select("id,action,target,notes,created_at")
      .order("id", { ascending: false })
      .limit(30),
  ]);
  for (const response of [products, suppliers, reports, audit])
    if (response.error) throw response.error;
  const queue: QueueEntry[] = [
    ...(suppliers.data ?? []).map((row) => ({
      id: row.id,
      label:
        "Supplier: " +
        (row.sourcing_businesses as unknown as { name: string })?.name,
      details: row.summary,
      kind: "supplier" as const,
      evidence: row.evidence_path,
      choices:
        row.state === "verified"
          ? [{ value: "restricted", label: "Restrict supplier" }]
          : [
              { value: "verified", label: "Approve verification" },
              { value: "rejected", label: "Reject verification" },
              { value: "restricted", label: "Restrict supplier" },
            ],
    })),
    ...(products.data ?? []).map((row) => ({
      id: row.id,
      label: "Listing: " + row.name,
      details: row.description || "No description",
      kind: "listing" as const,
      choices: [
        ...(row.publication_state === "submitted"
          ? [{ value: "under_review", label: "Start review" }]
          : []),
        { value: "published", label: "Approve publication" },
        { value: "rejected", label: "Reject listing" },
      ],
    })),
    ...(reports.data ?? []).map((row) => ({
      id: row.id,
      label:
        "Report: " +
        (row.sourcing_businesses as unknown as { name: string })?.name,
      details: row.complaint,
      kind: "report" as const,
      choices: [
        { value: "resolved", label: "Resolve report" },
        { value: "dismissed", label: "Dismiss report" },
      ],
    })),
  ];
  return { queue, audit: audit.data ?? [] };
}

function Review({ entry }: { entry: QueueEntry }) {
  const mutation = useMarketMutation();
  const [evidenceUrl, setEvidenceUrl] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sender = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    if (!sender?.value) return;
    const notes = formText(new FormData(event.currentTarget), "notes");
    const decision = sender.value;
    void mutation.run(
      () =>
        marketAction("review_" + entry.kind, {
          target: entry.id,
          decision,
          notes,
        }),
      "Review recorded.",
    );
  }
  return (
    <article className="record market-stack">
      <h3>{entry.label}</h3>
      <p>{entry.details}</p>
      {entry.evidence && (
        <div className="actions">
          <button
            className="outline"
            disabled={mutation.pending}
            onClick={() =>
              void mutation.run(
                async () =>
                  setEvidenceUrl(await signMarketFile(entry.evidence!, true)),
                "Private link available for one minute.",
              )
            }
          >
            Prepare evidence link
          </button>
          {evidenceUrl && (
            <a href={evidenceUrl} target="_blank" rel="noreferrer">
              Open private evidence
            </a>
          )}
        </div>
      )}
      <form className="form" onSubmit={submit}>
        <label>
          Review notes
          <textarea name="notes" rows={2} maxLength={2000} />
        </label>
        <div className="actions">
          {entry.choices.map((choice) => (
            <button
              key={choice.value}
              type="submit"
              className="outline"
              disabled={mutation.pending}
              value={choice.value}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </form>
      {mutation.feedback}
    </article>
  );
}

function Trust({ session }: { session: Session }) {
  const context = useQuery({
    queryKey: ["market", "context", session.user.id],
    queryFn: readMarketContext,
  });
  const queue = useQuery({
    queryKey: ["market", "trust", session.user.id],
    queryFn: readQueue,
    enabled: context.data?.operator === true,
  });
  if (context.isPending) return <p role="status">Checking operator access</p>;
  if (context.isError)
    return (
      <button className="outline" onClick={() => void context.refetch()}>
        Retry permission check
      </button>
    );
  if (!context.data?.operator)
    return <p role="alert">Operator access is required.</p>;
  return (
    <div className="market-stack">
      <h2>Moderation queue</h2>
      {queue.isPending && <p role="status">Loading reviews</p>}
      {queue.isError && (
        <button className="outline" onClick={() => void queue.refetch()}>
          Retry queue
        </button>
      )}
      {queue.isSuccess && !queue.data.queue.length && (
        <p>No items to review.</p>
      )}
      {queue.data?.queue.map((entry) => (
        <Review key={entry.kind + entry.id} entry={entry} />
      ))}
      <NearbyVerification />
      <h2>Audit trail</h2>
      <ul>
        {queue.data?.audit.map((event) => (
          <li key={event.id}>
            {event.action} / {event.target} /{" "}
            {new Date(event.created_at).toLocaleString()}
            {event.notes ? " / " + event.notes : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MarketTrust() {
  return (
    <MarketGate title="Trust Center">
      {(session) => <Trust key={session.user.id} session={session} />}
    </MarketGate>
  );
}
