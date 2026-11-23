import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Page } from "../page";
import { stockClient } from "../stock/client";
import { formatMinor } from "./catalog";
import { publishedCatalogue, publishedPageSize, supplierReviewLabels } from "./repository";

const catalogue = stockClient ? publishedCatalogue(stockClient) : null;

export function PublishedSourcing() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const reviewedOnly = params.get("reviewed") === "1";
  const sort = params.get("sort") === "moq" ? "moq" : "newest";
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(10000, requestedPage) : 1;
  const facets = useQuery({
    queryKey: ["published-sourcing-categories"],
    queryFn: () => catalogue!.categories(),
    enabled: Boolean(catalogue),
  });
  const results = useQuery({
    queryKey: ["published-sourcing", category, reviewedOnly, sort, page],
    queryFn: () => catalogue!.offers({ category, reviewedOnly, order: sort, page }),
    enabled: Boolean(catalogue),
  });
  function update(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  const total = results.data?.total ?? 0;
  return (
    <Page title="Published supplier offers">
      <Link className="outline" to="/sourcing">Browse demo catalogue</Link>
      {!catalogue ? <p>Published catalogue is unavailable in Demo Mode.</p> : (
        <>
          <div className="filterbar">
            <label>Category
              <select value={category} onChange={(event) => update("category", event.target.value)}>
                <option value="">All categories</option>
                {facets.data?.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
            </label>
            <label>Sort
              <select value={sort} onChange={(event) => update("sort", event.target.value)}>
                <option value="newest">Newest</option>
                <option value="moq">Minimum order</option>
              </select>
            </label>
            <label>
              <input type="checkbox" checked={reviewedOnly} onChange={(event) => update("reviewed", event.target.checked ? "1" : "")} />
              Reviewed suppliers only
            </label>
          </div>
          {results.isPending && <p role="status">Loading published offers…</p>}
          {(results.isError || facets.isError) && (
            <button className="outline" onClick={() => { void results.refetch(); void facets.refetch(); }}>Retry catalogue</button>
          )}
          {results.isSuccess && (
            <>
              <p aria-live="polite">{total} published offers</p>
              {!results.data.items.length && <p>No offers on this page.</p>}
              <div className="product-grid">
                {results.data.items.map((offer) => (
                  <article className="record" key={offer.id}>
                    <h2>{offer.sourcing_variants.sourcing_products.name}</h2>
                    <p>{offer.sourcing_businesses.name} · {supplierReviewLabels[offer.sourcing_businesses.verification] ?? "Unreviewed"}</p>
                    <p>{offer.method} · Minimum order {offer.minimum_quantity}</p>
                    <p>{offer.unit_price_minor === null ? "Quote required" : formatMinor(offer.unit_price_minor, offer.currency)}</p>
                  </article>
                ))}
              </div>
              <nav className="actions commerce-pagination" aria-label="Published offer pages">
                <button className="outline" disabled={page === 1} onClick={() => update("page", String(page - 1))}>Previous</button>
                <span>Page {page}</span>
                <button className="outline" disabled={page * publishedPageSize >= total} onClick={() => update("page", String(page + 1))}>Next</button>
              </nav>
            </>
          )}
        </>
      )}
    </Page>
  );
}
