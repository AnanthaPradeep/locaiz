import { useEffect } from "react";
import { FulfilmentDetails } from "./fulfilment-details";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Page } from "./page";
import { useMarketMutation, useMarketSession } from "./market-account";
import {
  formText,
  marketAction,
  marketClient,
  signMarketFile,
  trustLabels,
} from "./market-foundation";
import { PublicReviews } from "./market-reviews";
import { StorefrontStory } from "./market-storefront";
import { formatMinor } from "./sourcing/catalog";
import { publishedCatalogue, publishedPageSize } from "./sourcing/repository";

function Media({ path, alt }: { path: string; alt: string }) {
  const image = useQuery({
    queryKey: ["market", "public-media", path],
    queryFn: () => signMarketFile(path),
    staleTime: 30000,
    retry: false,
  });
  return image.data ? (
    <img
      className="market-photo"
      src={image.data}
      alt={alt}
      width={600}
      height={450}
      loading="lazy"
    />
  ) : null;
}

export function ConnectedResults({ params }: { params: URLSearchParams }) {
  const browseViewer = useMarketSession()?.user.id;
  const page = Number(params.get("connectedPage"));
  const keyword = (params.get("q") ?? "").trim().slice(0, 120);
  const categories = params.getAll("category");
  const results = useQuery({
    queryKey: [
      "market",
      "public-offers",
      keyword,
      categories,
      page,
      params.get("sort"),
    ],
    queryFn: () =>
      publishedCatalogue(marketClient!).offers({
        keyword,
        categoryNames: categories,
        marketplaceOnly: true,
        page,
        order: "newest",
      }),
    enabled: !!marketClient,
  });
  const currentOffers = results.data?.items;
  useEffect(() => {
    if (!browseViewer || !keyword || !currentOffers?.length) return;
    const productIds = [...new Set(currentOffers.map(offer => offer.product_id))];
    void marketClient?.rpc("record_search_page", { products: productIds }).then(() => undefined);
  }, [browseViewer, keyword, currentOffers]);
  const update = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("connectedPage", String(page));
    return "?" + next;
  };
  if (!marketClient) return null;
  return (
    <section
      aria-label="Published marketplace listings"
      className="market-stack"
    >
      <h2>Published marketplace listings</h2>
      {results.isPending && <p role="status">Loading published listings</p>}
      {results.isError && (
        <button className="outline" onClick={() => void results.refetch()}>
          Retry published listings
        </button>
      )}
      {results.isSuccess && (
        <>
          <p>{results.data.total} published offers</p>
          <div className="market-grid">
            {results.data.items.map((offer) => (
              <article className="record market-stack" key={offer.id}>
                <h3>
                  <Link to={"/listing/shop/" + offer.product_id}>
                    {offer.sourcing_variants.sourcing_products.name}
                  </Link>
                </h3>
                <Link to={"/supplier/" + offer.sourcing_businesses.id}>
                  {offer.sourcing_businesses.name}
                </Link>
                <p>
                  {offer.unit_price_minor === null
                    ? "Quote required"
                    : formatMinor(offer.unit_price_minor, offer.currency)}{" "}
                  / MOQ {offer.minimum_quantity}
                </p>
                <FulfilmentDetails compact shippingCountries={offer.shipping_countries} pickup={Boolean(offer.pickup_id)} />
              </article>
            ))}
          </div>
          {results.data.total > publishedPageSize && (
            <nav aria-label="Published marketplace pages" className="actions">
              {results.data.page > 1 && (
                <Link className="outline" to={update(results.data.page - 1)}>
                  Previous published page
                </Link>
              )}
              <span>Page {results.data.page}</span>
              {results.data.page * publishedPageSize < results.data.total && (
                <Link className="outline" to={update(results.data.page + 1)}>
                  Next published page
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}

type PublicProduct = {
  id: string;
  name: string;
  description: string;
  owner_business_id: string | null;
  market_media: { object_name: string; alt_text: string }[];
  sourcing_variants: { id: string; name: string }[];
  sourcing_categories: { name: string };
};
export function PublishedProduct({ id }: { id: string }) {
  const viewer = useMarketSession()?.user.id;
  const product = useQuery({
    queryKey: ["market", "public-product", id],
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("sourcing_products")
        .select(
          "id,name,description,owner_business_id,market_media(object_name,alt_text),sourcing_variants(id,name),sourcing_categories(name)",
        )
        .eq("id", id)
        .eq("publication_state", "published")
        .maybeSingle()
        .overrideTypes<PublicProduct, { merge: false }>();
      if (error) throw error;
      return data;
    },
    enabled: !!marketClient,
  });
  const published = Boolean(product.data);
  useEffect(() => {
    if (viewer && published) void marketClient?.rpc("record_product_view", {product:id}).then(() => undefined);
  }, [viewer,published,id]);
  const offers = useQuery({
    queryKey: ["market", "public-product-offers", id],
    queryFn: () => publishedCatalogue(marketClient!).offers({ productId: id }),
    enabled: !!marketClient && !!product.data,
  });
  if (product.isPending || (product.data && offers.isPending))
    return (
      <Page title="Product">
        <p role="status">Loading published product</p>
      </Page>
    );
  if (product.isError)
    return (
      <Page title="Product">
        <button className="outline" onClick={() => void product.refetch()}>
          Retry product
        </button>
      </Page>
    );
  const item = product.data;
  if (!item || !offers.data?.total)
    return (
      <Page title="Product unavailable">
        <Link to="/shop">Back to Shop</Link>
      </Page>
    );
  return (
    <Page title={item.name} intro={item.description}>
      <div className="market-stack">
        <p>{item.sourcing_categories?.name}</p>
        {item.owner_business_id && (
          <Link className="outline" to={"/supplier/" + item.owner_business_id}>
            Supplier Trust Passport
          </Link>
        )}
        {item.owner_business_id && <Link className="outline" to={"/account/journey?" + new URLSearchParams({supplier:item.owner_business_id,product:item.id})}>Start product enquiry</Link>}
        <div className="market-grid">
          {item.market_media.map((media) => (
            <Media
              key={media.object_name}
              path={media.object_name}
              alt={media.alt_text}
            />
          ))}
        </div>
        <h2>Variants and offers</h2>
        {offers.data?.items.map((offer) => (
          <article className="record" key={offer.id}>
            <h3>
              {item.sourcing_variants.find((v) => v.id === offer.variant_id)
                ?.name ?? offer.variant_id}
            </h3>
            <p>
              {offer.method} / MOQ {offer.minimum_quantity} /{" "}
              {offer.unit_price_minor === null
                ? "Quote required"
                : formatMinor(offer.unit_price_minor, offer.currency)}
            </p>
            <FulfilmentDetails productionDays={offer.lead_days} shippingCountries={offer.shipping_countries} pickup={Boolean(offer.pickup_id)} />
            {item.owner_business_id && (
              <Link
                className="outline"
                to={"/account/journey?" + new URLSearchParams({supplier:item.owner_business_id,product:item.id,variant:offer.variant_id})}
              >
                Enquire about this variant
              </Link>
            )}
          </article>
        ))}
        {item.owner_business_id && <PublicReviews business={item.owner_business_id} product={item.id} />}
      </div>
    </Page>
  );
}

type Supplier = {
  id: string;
  name: string;
  description: string;
  roles: string[];
  trust_state: string;
  capabilities: string[];
  sourcing_places: { name: string; country_code: string | null };
  market_locations: {
    id: string;
    locality: string;
    country_code: string;
    pickup: boolean;
  }[];
};
export default function SupplierPassport() {
  const { id = "" } = useParams();
  const mutation = useMarketMutation();
  const session = useMarketSession();
  const business = useQuery({
    queryKey: ["market", "public-business", id],
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("sourcing_businesses")
        .select(
          "id,name,description,roles,trust_state,capabilities,sourcing_places!sourcing_businesses_base_id_fkey(name,country_code),market_locations(id,locality,country_code,pickup)",
        )
        .eq("id", id)
        .eq("published", true)
        .neq("trust_state", "restricted")
        .maybeSingle()
        .overrideTypes<Supplier, { merge: false }>();
      if (error) throw error;
      return data;
    },
    enabled: !!marketClient && /^[a-f0-9-]{36}$/i.test(id),
  });
  const offers = useQuery({
    queryKey: ["market", "passport-offers", id],
    queryFn: () => publishedCatalogue(marketClient!).offers({ businessId: id }),
    enabled: !!business.data,
  });
  const portfolio = useQuery({
    queryKey: ["market", "passport-media", id],
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("sourcing_products")
        .select("id,market_media(object_name,alt_text)")
        .eq("owner_business_id", id)
        .eq("publication_state", "published")
        .limit(4);
      if (error) throw error;
      return data.flatMap((product) => product.market_media).slice(0, 4);
    },
    enabled: !!business.data,
  });
  if (!marketClient)
    return (
      <Page title="Supplier Trust Passport">
        <p>Connected supplier passports are unavailable in Demo Mode.</p>
        <Link to="/sourcing">Browse Global Atlas</Link>
      </Page>
    );
  if (business.fetchStatus === "fetching")
    return (
      <Page title="Supplier Trust Passport">
        <p role="status">Loading supplier</p>
      </Page>
    );
  if (business.isError)
    return (
      <Page title="Supplier Trust Passport">
        <button className="outline" onClick={() => void business.refetch()}>
          Retry supplier
        </button>
      </Page>
    );
  if (!business.data)
    return (
      <Page title="Supplier unavailable">
        <Link to="/sourcing">Back to Global Atlas</Link>
      </Page>
    );
  const supplier = business.data;
  return (
    <Page
      title={supplier.name}
      label="SUPPLIER TRUST PASSPORT"
      intro={supplier.description}
    >
      <div className="market-stack">
        <StorefrontStory id={supplier.id} name={supplier.name} verified={supplier.trust_state === "verified"} />
        <section className="record">
          {supplier.trust_state === "verified" && <Link className="outline" to={"/account/journey?" + new URLSearchParams({supplier:supplier.id})}>Request a quote</Link>}
          <h2>{trustLabels[supplier.trust_state] ?? "Unverified"}</h2>
          <p>
            {supplier.roles.join(", ")} /{" "}
            {[
              supplier.sourcing_places?.name,
              supplier.sourcing_places?.country_code,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p>{supplier.capabilities.join(", ")}</p>
          <ul>
            {supplier.market_locations.map((location) => (
              <li key={location.id}>
                {location.locality}, {location.country_code}
                {location.pickup ? " / Pickup offered, stock unconfirmed" : ""}
              </li>
            ))}
          </ul>
        </section>
        <div className="market-grid">
          {portfolio.data?.map((media) => (
            <Media
              key={media.object_name}
              path={media.object_name}
              alt={media.alt_text}
            />
          ))}
        </div>
        <h2>Published offers</h2>
        {offers.data?.items.map((offer) => (
          <article className="record market-stack" key={offer.id}>
            <h3>
              <Link to={"/listing/shop/" + offer.product_id}>
                {offer.sourcing_variants.sourcing_products.name}
              </Link>
            </h3>
            <p>
              {
                offer.sourcing_variants.sourcing_products.sourcing_categories
                  ?.name
              }{" "}
              / {offer.method} / MOQ {offer.minimum_quantity}
            </p>
            <p>
              {offer.custom_order ? "Custom orders accepted" : null}
              {offer.pickup_id ? " / Pickup offered" : null}
            </p>
            {!!offer.shipping_countries?.length && (
              <p>Ships to {offer.shipping_countries.join(", ")}</p>
            )}
          </article>
        ))}
        <PublicReviews business={supplier.id} />
        {session ? (
          <form
            className="record form"
            onSubmit={(event) => {
              event.preventDefault();
              const complaint = formText(
                new FormData(event.currentTarget),
                "complaint",
              );
              void mutation.run(
                () => marketAction("report", { business: id, complaint }),
                "Report submitted for review.",
              );
            }}
          >
            <h2>Report business</h2>
            <label>
              Reason
              <textarea
                name="complaint"
                minLength={10}
                maxLength={2000}
                required
              />
            </label>
            <button className="outline" disabled={mutation.pending}>
              Submit report
            </button>
            {mutation.feedback}
          </form>
        ) : (
          <Link to="/account/sign-in">Sign in to report this business</Link>
        )}
      </div>
    </Page>
  );
}
