import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { marketClient } from "../market-foundation";
import { Page } from "../page";
import { regionalCrafts, regionalDirectoryHref, regionalRequestHref } from "../regional-crafts";
import { regionalOfferKeywords, sampleRegionalMakers } from "./regional-data";
import { regionalLocations } from "./regional-repository";
import { publishedCatalogue, publishedPageSize } from "./repository";

export function RegionalMakers() {
  const [params, setParams] = useSearchParams();
  const region = regionalCrafts.find(({ id }) => id === params.get("region")) ?? regionalCrafts[0];
  const craft = region.crafts.find((name) => name === params.get("craft")) ?? region.crafts[0];
  const requestedLocation = params.get("locality") ?? "";
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(10000, requestedPage) : 1;
  const locations = useQuery({
    queryKey: ["market", "regional-maker-locations", region.id],
    queryFn: () => regionalLocations(marketClient!, region.state),
    enabled: Boolean(marketClient),
    staleTime: 300000,
  });
  const samples = sampleRegionalMakers.filter((maker) => maker.region === region.id);
  const localities = marketClient
    ? locations.data ?? []
    : [...new Set(samples.map((maker) => maker.locality))].sort().map((name) => ({ id: name, name }));
  const locality = localities.find(({ id }) => id === requestedLocation);
  const results = useQuery({
    queryKey: ["market", "regional-maker-offers", region.id, craft, locality?.id, page],
    queryFn: () => publishedCatalogue(marketClient!).offers({
      keyword: regionalOfferKeywords[craft] ?? craft,
      businessBaseIds: locality ? [locality.id] : localities.map(({ id }) => id),
      marketplaceOnly: true,
      verifiedOnly: true,
      makerOnly: true,
      page,
    }),
    enabled: Boolean(marketClient && locations.isSuccess && localities.length),
  });
  const makers = marketClient
    ? [...new Set(results.data?.items.map((offer) => offer.sourcing_businesses.id))].map((id) => {
      const matching = results.data!.items.filter((offer) => offer.sourcing_businesses.id === id);
      const business = matching[0].sourcing_businesses;
      return {
        id,
        name: business.name,
        locality: localities.find((place) => place.id === business.base_id)?.name,
        offers: matching.map((offer) => ({
          id: offer.id,
          name: offer.sourcing_variants.sourcing_products.name,
          minimum: offer.minimum_quantity,
          custom: offer.custom_order,
          pickup: Boolean(offer.pickup_id),
        })),
      };
    })
    : samples.filter((maker) => maker.craft === craft && (!locality || maker.locality === locality.name))
      .map((maker) => ({ ...maker, offers: [{ ...maker, name: maker.craft }] }));
  const loading = Boolean(marketClient && (locations.isPending || results.isFetching));
  const failed = Boolean(marketClient && (locations.isError || results.isError));
  const request = regionalRequestHref(region.id, craft, Boolean(marketClient));

  function filter(values: Record<string, string>) {
    const next = new URLSearchParams({ region: region.id, craft, locality: locality?.id ?? "", ...values });
    for (const key of ["locality", "page"]) if (!next.get(key)) next.delete(key);
    setParams(next);
  }

  return (
    <Page title="Regional Maker Discovery" label="GLOBAL ATLAS" intro="Browse regional crafts and find a maker for your sourcing request.">
      <Link to="/sourcing">Back to Global Atlas</Link>
      <nav className="actions sourcing-shortcuts" aria-label="Craft regions">
        {regionalCrafts.map(({ id, state }) => (
          <Link key={id} className={id === region.id ? "button" : "outline"}
            aria-current={id === region.id ? "page" : undefined} to={regionalDirectoryHref(id)}>{state}</Link>
        ))}
      </nav>
      <div className="filterbar">
        <label>Craft
          <select value={craft} onChange={(event) => filter({ craft: event.target.value })}>
            {region.crafts.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <label>Maker location
          <select value={locality?.id ?? ""} onChange={(event) => filter({ locality: event.target.value })}>
            <option value="">All locations in {region.state}</option>
            {localities.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </div>
      <section aria-label="Regional makers" className="market-stack">
        <h2>{craft} makers in {locality?.name ?? region.state}</h2>
        {!marketClient && <p>Demo directory with sample makers and illustrative order terms.</p>}
        {loading && <p role="status">Loading published maker offers…</p>}
        {failed && <p role="alert">Maker listings are temporarily unavailable. You can still start a sourcing request.</p>}
        {!loading && !failed && !makers.length && <p>No makers listed for this craft and location yet.</p>}
        <div className="market-grid">
          {makers.map((maker) => (
            <article key={maker.id} className="record market-stack">
              <h3>{maker.name}</h3>
              {maker.locality && <p>{maker.locality}, {region.state}</p>}
              <ul>
                {maker.offers.map((offer) => (
                  <li key={offer.id}>
                    <strong>{offer.name}</strong> · Minimum order {offer.minimum}
                    {offer.custom && " · Custom orders accepted"}
                    {offer.pickup && " · Pickup offered"}
                  </li>
                ))}
              </ul>
              <Link className="outline" aria-label={"View maker profile for " + maker.name} to={
                (marketClient ? "/supplier/" : "/sourcing/supplier/") + maker.id + "?" +
                new URLSearchParams({ region: region.id, craft })
              }>View maker profile</Link>
            </article>
          ))}
        </div>
        {marketClient && (page > 1 || (results.data?.total ?? 0) > page * publishedPageSize) && (
          <nav className="actions" aria-label="Regional offer pages">
            <button className="outline" disabled={page === 1} onClick={() => filter({ page: String(page - 1) })}>Previous</button>
            <span>Page {page}</span>
            <button className="outline" disabled={!results.data || results.data.total <= page * publishedPageSize} onClick={() => filter({ page: String(page + 1) })}>Next</button>
          </nav>
        )}
        <div className="actions">
          <Link className="button" to={request}>Start a sourcing request</Link>
        </div>
      </section>
    </Page>
  );
}
