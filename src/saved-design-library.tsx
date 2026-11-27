import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMarketMutation } from "./market-account";
import { marketClient } from "./market-foundation";
import { designPageSize, designRfqHref, listSavedDesigns, savedDesignsHref } from "./saved-designs";

export function SaveDesignForm({ sourceOrder, name, specifications, copiedFrom }: {
  sourceOrder: string;
  name: string;
  specifications: string;
  copiedFrom?: string;
}) {
  const formId = useId();
  const [id, setId] = useState(() => crypto.randomUUID());
  const [savedId, setSavedId] = useState("");
  const mutation = useMarketMutation();
  const label = copiedFrom ? "Save as new design" : "Save design";
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void mutation.run(async () => {
      const { error } = await marketClient!.rpc("journey_save_design", {
        payload: { ...Object.fromEntries(fields), id, sourceOrder, copiedFrom },
      });
      if (error) throw error;
      setSavedId(id);
    }, "Design saved.");
  }

  return (
    <details>
      <summary>{copiedFrom ? "Save as new design" : "Save to Saved Designs"}</summary>
      {savedId ? (
        <div className="actions">
          <Link to={designRfqHref(savedId)}>Start RFQ from saved design</Link>
          <Link to={savedDesignsHref}>Open Saved Designs</Link>
          {copiedFrom && <button type="button" className="outline" onClick={() => {
            setId(crypto.randomUUID());
            setSavedId("");
          }}>Create another copy</button>}
        </div>
      ) : (
        <form className="journey-form" onSubmit={save}>
          <label>Design name
            <input name="name" required minLength={3} maxLength={120} defaultValue={name} />
          </label>
          <div className="journey-stack">
            <label htmlFor={formId}>Design specifications</label>
            <textarea id={formId} name="specifications" maxLength={3000} defaultValue={specifications} />
          </div>
          <div className="actions">
            <button className="button" disabled={mutation.pending}>{label}</button>
          </div>
        </form>
      )}
      {mutation.feedback}
    </details>
  );
}

export function SavedDesignLibrary({ user }: { user: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const designs = useQuery({
    queryKey: ["market", "saved-designs", user, search, page],
    queryFn: () => listSavedDesigns(user, search.trim(), page),
  });
  return (
    <section className="journey-stack" aria-label="Saved design library">
      <label className="journey-form">Search by design name or craft
        <input type="search" maxLength={120} value={search} onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
        }} />
      </label>
      {designs.isPending && <p role="status">Loading saved designs</p>}
      {designs.isError && (
        <p role="alert">Unable to load saved designs.{" "}
          <button className="outline" onClick={() => void designs.refetch()}>Retry</button>
        </p>
      )}
      {designs.data?.count === 0 && (
        <p>{search.trim() ? "No designs match your search." : "Save a design from a completed order to start your library."}</p>
      )}
      <div className="market-grid">
        {designs.data?.designs.map((design) => (
          <article className="record journey-stack" key={design.id}>
            <h2>{design.name}</h2>
            {design.copied_from && <p>Design variant</p>}
            {design.specifications && (
              <details>
                <summary>Specifications</summary>
                <p className="journey-message">{design.specifications}</p>
              </details>
            )}
            <Link className="outline" to={designRfqHref(design.id)}>Start RFQ</Link>
            <SaveDesignForm sourceOrder={design.source_order_id} copiedFrom={design.id}
              name={design.name} specifications={design.specifications} />
          </article>
        ))}
      </div>
      {(page > 0 || (designs.data?.count ?? 0) > designPageSize) && (
        <nav className="actions" aria-label="Saved design pages">
          <button className="outline" disabled={!page} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page + 1}</span>
          <button className="outline" disabled={!designs.data || (page + 1) * designPageSize >= designs.data.count}
            onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  );
}
