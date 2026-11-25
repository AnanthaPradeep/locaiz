import { StorefrontEditor } from "./market-storefront";
import { useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MarketGate, useMarketMutation } from "./market-account";
import {
  businessTypes,
  formText,
  marketAction,
  marketClient,
  methods,
  parsePriceTiers,
  readMarketContext,
  trustLabels,
  uploadMarketFile,
  validateUpload,
} from "./market-foundation";

type Business = Awaited<
  ReturnType<typeof readMarketContext>
>["businesses"][number];
type Offer = {
  method: string;
  currency: string;
  unit_price_minor: number | null;
  minimum_quantity: number;
  pickup_id: string | null;
  lead_days: number | null;
  shipping_countries: string[];
  custom_order: boolean;
  sourcing_price_tiers: { quantity: number; unit_price_minor: number }[];
};
type Product = {
  id: string;
  name: string;
  description: string;
  category_id: string;
  publication_state: string;
  sourcing_variants: {
    id: string;
    name: string;
    sourcing_offers: Offer[];
    market_inventory: { quantity: number } | { quantity: number }[] | null;
  }[];
  market_media: { object_name: string }[];
};
function inventoryOf(variant?: Product["sourcing_variants"][number]) {
  const inventory = variant?.market_inventory;
  return Array.isArray(inventory)
    ? inventory[0]?.quantity
    : inventory?.quantity;
}
const listingFields =
  "id,name,description,category_id,publication_state,sourcing_variants(id,name,sourcing_offers(method,currency,unit_price_minor,minimum_quantity,pickup_id,lead_days,shipping_countries,custom_order,sourcing_price_tiers(quantity,unit_price_minor)),market_inventory(quantity)),market_media(object_name)";

function BusinessForm() {
  const mutation = useMarketMutation();
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void mutation.run(
      () =>
        marketAction("create_business", {
          name: formText(data, "name"),
          city: formText(data, "city"),
          country: formText(data, "country"),
          description: formText(data, "description"),
          type: formText(data, "type"),
          capabilities: data.getAll("capabilities"),
          pickup: data.has("pickup"),
        }),
      "Business created.",
    );
  }
  return (
    <details className="record" open>
      <summary>Create a business</summary>
      <form className="form" onSubmit={save}>
        <label>
          Business name
          <input name="name" required minLength={2} maxLength={120} />
        </label>
        <label>
          Business type
          <select name="type">
            {businessTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Public description
          <textarea name="description" maxLength={2000} />
        </label>
        <label>
          Locality
          <input name="city" required minLength={2} maxLength={120} />
        </label>
        <label>
          Country code
          <input
            name="country"
            defaultValue="IN"
            required
            pattern="[A-Za-z]{2}"
          />
        </label>
        <fieldset>
          <legend>Purchasing capabilities</legend>
          {methods.map((method) => (
            <label key={method}>
              <input type="checkbox" value={method} name="capabilities" />{" "}
              {method}
            </label>
          ))}
        </fieldset>
        <label>
          <input type="checkbox" name="pickup" /> Pickup offered
        </label>
        <button className="button" disabled={mutation.pending}>
          Create business
        </button>
        {mutation.feedback}
      </form>
    </details>
  );
}

function BusinessSettings({ business }: { business: Business }) {
  const mutation = useMarketMutation();
  const [invitation, setInvitation] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const locations = useQuery({
    queryKey: ["market", "locations", business.id],
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("market_locations")
        .select("id,locality,country_code,pickup")
        .eq("business_id", business.id)
        .order("locality");
      if (error) throw error;
      return data;
    },
  });
  function onAction(action: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void mutation.run(
      async () => {
        if (action === "add_location")
          return marketAction(action, {
            business: business.id,
            city: formText(data, "city"),
            country: formText(data, "country"),
            pickup: data.has("pickup"),
          });
        if (action === "invite") {
          const id = await marketAction(action, {
            business: business.id,
            email: formText(data, "email"),
            role: formText(data, "role"),
          });
          const url = new URL(window.location.pathname, window.location.origin);
          url.hash = "/account/sign-in?invite=" + encodeURIComponent(id);
          setInvitation(url.href);
          return;
        }
        const file = data.get("evidence");
        const path =
          file instanceof File && file.size
            ? await uploadMarketFile(file, business.id, true)
            : undefined;
        await marketAction(action, {
          business: business.id,
          path,
          summary: formText(data, "summary"),
        });
      },
      action === "invite"
        ? "Invitation link created. Share it privately with the named teammate."
        : action === "verify_request"
          ? "Verification submitted for operator review."
          : "Location added.",
    );
  }
  return (
    <section className="market-stack">
      <div className="actions">
        <h2>{business.name}</h2>
        <span>{trustLabels[business.trust]}</span>
        <button
          className="outline"
          aria-expanded={showSettings}
          onClick={() => setShowSettings(!showSettings)}
        >
          Business settings
        </button>
        {business.trust === "verified" && (
          <Link to={"/supplier/" + business.id}>Open public passport</Link>
        )}
      </div>
      {showSettings && (
        <div className="market-grid">
          <section className="record market-stack">
            <h3>Public profile</h3>
            <p>
              {business.type} / {business.description || "Description missing"}
            </p>
            <ul>
              {locations.data?.map((location) => (
                <li key={location.id}>
                  {location.locality}, {location.country_code}
                  {location.pickup ? " / Pickup offered" : ""}
                </li>
              ))}
            </ul>
            {business.role !== "catalogue" && (
              <form
                className="form"
                onSubmit={(event) => onAction("add_location", event)}
              >
                <label>
                  Additional locality
                  <input name="city" required maxLength={120} />
                </label>
                <label>
                  Location country code
                  <input
                    name="country"
                    defaultValue="IN"
                    required
                    pattern="[A-Za-z]{2}"
                  />
                </label>
                <label>
                  <input type="checkbox" name="pickup" /> Pickup at location
                </label>
                <button className="outline" disabled={mutation.pending}>
                  Add location
                </button>
              </form>
            )}
          </section>
          {business.role === "owner" && (
            <form
              className="record form"
              onSubmit={(event) => onAction("invite", event)}
            >
              <h3>Invite a teammate</h3>
              <label>
                Teammate email
                <input name="email" type="email" required />
              </label>
              <label>
                Team role
                <select name="role">
                  <option value="catalogue">Catalogue editor</option>
                  <option value="manager">Manager</option>
                </select>
              </label>
              <button className="outline" disabled={mutation.pending}>
                Create team invitation
              </button>
              {invitation && (
                <label>
                  Private invitation link
                  <input readOnly value={invitation} />
                </label>
              )}
            </form>
          )}
          {business.role !== "catalogue" && (
            <form
              className="record form"
              onSubmit={(event) => onAction("verify_request", event)}
            >
              <h3>Verification</h3>
              <label>
                Verification summary
                <textarea name="summary" maxLength={2000} required />
              </label>
              <label>
                Private verification evidence
                <input
                  name="evidence"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                />
              </label>
              <button
                className="outline"
                disabled={
                  mutation.pending ||
                  business.trust === "pending" ||
                  business.trust === "restricted"
                }
              >
                Submit verification
              </button>
            </form>
          )}
        </div>
      )}
      {mutation.feedback}
    </section>
  );
}

function ProductEditor({
  business,
  product,
  sku,
  onSave,
}: {
  business: Business;
  product?: Product;
  sku?: string;
  onSave: (id: string) => void;
}) {
  const mutation = useMarketMutation();
  const [draftId, setDraftId] = useState(product?.id);
  const variant = product?.sourcing_variants.find((item) => item.id === sku);
  const offer = variant?.sourcing_offers[0];
  const categories = useQuery({
    queryKey: ["market", "categories"],
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("sourcing_categories")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void mutation.run(async () => {
      const files = form
        .getAll("images")
        .filter((item): item is File => item instanceof File && item.size > 0);
      if (files.length > 6)
        throw new Error("Choose at most six images at a time.");
      files.forEach((file) => validateUpload(file));
      const target = await marketAction("save_listing", {
        business: business.id,
        target: draftId,
        name: formText(form, "name"),
        description: formText(form, "description"),
        category: formText(form, "category"),
        sku: formText(form, "sku"),
        variant: formText(form, "variant"),
        method: formText(form, "method"),
        currency: formText(form, "currency"),
        price: formText(form, "price") || null,
        moq: Number(form.get("moq")),
        quantity: Number(form.get("quantity")),
        tiers: parsePriceTiers(formText(form, "tiers")),
        lead: formText(form, "lead") || null,
        pickup: form.has("pickup"),
        custom: form.has("custom"),
        countries: formText(form, "countries")
          .split(",")
          .map((code) => code.trim())
          .filter(Boolean),
      });
      setDraftId(target);
      onSave(target);
      for (const file of files) {
        const path = await uploadMarketFile(file, business.id + "/" + target);
        await marketAction("attach_media", {
          business: business.id,
          target,
          path,
          alt: formText(form, "alt"),
        });
      }
    }, "Draft saved.");
  }
  return (
    <form className="record form market-editor" onSubmit={save}>
      <h3>
        {product
          ? variant
            ? "Edit variant"
            : "Add a variant"
          : "New product draft"}
      </h3>
      <label>
        Product name
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={product?.name}
        />
      </label>
      <label>
        Product description
        <textarea
          name="description"
          maxLength={3000}
          defaultValue={product?.description}
        />
      </label>
      <label>
        Category
        <select
          name="category"
          required
          defaultValue={product?.category_id ?? ""}
        >
          <option value="">Choose a category</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        SKU
        <input
          name="sku"
          required
          pattern="[A-Za-z0-9_-]{1,80}"
          defaultValue={variant?.id}
          readOnly={!!variant}
        />
      </label>
      <label>
        Variant name
        <input
          name="variant"
          maxLength={120}
          defaultValue={variant?.name ?? "Standard"}
        />
      </label>
      <label>
        Purchase method
        <select name="method" defaultValue={offer?.method ?? methods[0]}>
          {methods.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
      </label>
      <label>
        Currency
        <input
          name="currency"
          required
          pattern="[A-Za-z]{3}"
          defaultValue={offer?.currency ?? "INR"}
        />
      </label>
      <label>
        Unit price in minor units
        <input
          name="price"
          type="number"
          min={0}
          max={2147483647}
          defaultValue={offer?.unit_price_minor ?? undefined}
        />
      </label>
      <label>
        Minimum order
        <input
          name="moq"
          type="number"
          min={1}
          max={1000000}
          required
          defaultValue={offer?.minimum_quantity ?? 1}
        />
      </label>
      <label>
        Inventory quantity
        <input
          name="quantity"
          type="number"
          min={0}
          max={1000000}
          required
          defaultValue={inventoryOf(variant) ?? 0}
        />
      </label>
      <label>
        Price tiers (quantity:minor units)
        <textarea
          name="tiers"
          maxLength={1500}
          defaultValue={offer?.sourcing_price_tiers
            .map((t) => t.quantity + ":" + t.unit_price_minor)
            .join("\n")}
        />
      </label>
      <label>
        Production lead days
        <input
          name="lead"
          type="number"
          min={0}
          defaultValue={offer?.lead_days ?? undefined}
        />
      </label>
      <label>
        Shipping country codes
        <input
          name="countries"
          placeholder="IN, US"
          defaultValue={offer?.shipping_countries.join(", ")}
        />
      </label>
      <label>
        <input
          type="checkbox"
          name="pickup"
          defaultChecked={!!offer?.pickup_id}
        />{" "}
        Pickup offered
      </label>
      <label>
        <input
          type="checkbox"
          name="custom"
          defaultChecked={offer?.custom_order}
        />{" "}
        Custom orders accepted
      </label>
      <label>
        Product images
        <input
          name="images"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
        />
      </label>
      <label>
        Image description
        <input name="alt" maxLength={160} />
      </label>
      <button
        className="button"
        disabled={mutation.pending || !categories.data}
      >
        Save draft
      </button>
      {mutation.feedback}
    </form>
  );
}

function BusinessCatalogue({
  business,
  user,
}: {
  business: Business;
  user: string;
}) {
  const [editor, setEditor] = useState<{ id?: string; sku?: string } | null>(
    null,
  );
  const [saved, setSaved] = useState("");
  const mutation = useMarketMutation();
  const products = useQuery({
    queryKey: ["market", "studio", user, business.id],
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("sourcing_products")
        .select(listingFields)
        .eq("owner_business_id", business.id)
        .order("created_at", { ascending: false })
        .overrideTypes<Product[], { merge: false }>();
      if (error) throw error;
      return data;
    },
  });
  const items = products.data ?? [];
  const item = items.find((product) => product.id === editor?.id);
  return (
    <div className="market-stack">
      <BusinessSettings business={business} />
      <StorefrontEditor key={business.id} id={business.id} />
      <dl className="market-grid market-metrics">
        <div>
          <dt>Published products</dt>
          <dd>
            {items.filter((p) => p.publication_state === "published").length}
          </dd>
        </div>
        <div>
          <dt>Draft products</dt>
          <dd>{items.filter((p) => p.publication_state === "draft").length}</dd>
        </div>
        <div>
          <dt>Awaiting review</dt>
          <dd>
            {
              items.filter((p) =>
                ["submitted", "under_review"].includes(p.publication_state),
              ).length
            }
          </dd>
        </div>
        <div>
          <dt>Active offers</dt>
          <dd>
            {
              items
                .filter((p) => p.publication_state === "published")
                .flatMap((p) =>
                  p.sourcing_variants.flatMap((v) => v.sourcing_offers),
                ).length
            }
          </dd>
        </div>
        <div>
          <dt>Profile details completed</dt><dd>{2 + Number(Boolean(business.description)) + Number(business.capabilities.length > 0)} / 4</dd>
        </div>
        <div>
          <dt>Low-stock variants (0 to 5)</dt>
          <dd>
            {
              items
                .flatMap((p) => p.sourcing_variants)
                .filter((v) => (inventoryOf(v) ?? 6) <= 5).length
            }
          </dd>
        </div>
      </dl>
      <div className="actions">
        <button className="button" onClick={() => setEditor({})}>
          New product
        </button>
        {editor && (
          <button className="outline" onClick={() => setEditor(null)}>
            Close editor
          </button>
        )}
      </div>
      {editor && (
        <ProductEditor
          key={editor.id + ":" + (editor.sku ?? "new")}
          business={business}
          product={item}
          sku={editor.sku}
          onSave={setSaved}
        />
      )}
      {saved && <p role="status">Listing saved.</p>}
      {products.isPending && <p role="status">Loading catalogue</p>}
      {products.isError && (
        <button className="outline" onClick={() => void products.refetch()}>
          Retry catalogue
        </button>
      )}
      {products.isSuccess && !items.length && <p>No products yet.</p>}
      {items.map((product) => (
        <article className="record market-stack" key={product.id}>
          <h3>{product.name}</h3>
          <p>
            {product.publication_state.replaceAll("_", " ")} /{" "}
            {product.market_media.length} images
          </p>
          {product.sourcing_variants.map((variant) => (
            <form
              className="actions"
              key={variant.id}
              onSubmit={(event) => {
                event.preventDefault();
                const quantity = Number(
                  new FormData(event.currentTarget).get("quantity"),
                );
                void mutation.run(
                  () =>
                    marketAction("inventory", {
                      business: business.id,
                      target: product.id,
                      sku: variant.id,
                      quantity,
                    }),
                  "Inventory updated.",
                );
              }}
            >
              <label>
                {variant.id} inventory
                <input
                  name="quantity"
                  type="number"
                  min={0}
                  max={1000000}
                  required
                  defaultValue={inventoryOf(variant) ?? 0}
                />
              </label>
              <button
                className="outline"
                disabled={
                  mutation.pending || product.publication_state === "archived"
                }
              >
                Update inventory
              </button>
              {["draft", "rejected"].includes(product.publication_state) && (
                <button
                  className="outline"
                  type="button"
                  onClick={() => setEditor({ id: product.id, sku: variant.id })}
                >
                  Edit {variant.id}
                </button>
              )}
            </form>
          ))}
          <div className="actions">
            {["draft", "rejected"].includes(product.publication_state) && (
              <>
                <button
                  className="outline"
                  onClick={() => setEditor({ id: product.id })}
                >
                  Add variant
                </button>
                <button
                  className="button"
                  disabled={mutation.pending}
                  onClick={() =>
                    void mutation.run(
                      () =>
                        marketAction("listing_state", {
                          business: business.id,
                          target: product.id,
                          decision: "submitted",
                        }),
                      "Listing submitted.",
                    )
                  }
                >
                  Submit for publication
                </button>
              </>
            )}
            {product.publication_state !== "archived" && (
              <button
                className="outline"
                disabled={mutation.pending}
                onClick={() =>
                  void mutation.run(
                    () =>
                      marketAction("listing_state", {
                        business: business.id,
                        target: product.id,
                        decision: "archived",
                      }),
                    "Listing archived.",
                  )
                }
              >
                {product.publication_state === "published"
                  ? "Unpublish and archive"
                  : "Archive"}
              </button>
            )}
          </div>
        </article>
      ))}
      {mutation.feedback}
    </div>
  );
}

function Studio({ session }: { session: Session }) {
  const [choice, setChoice] = useState("");
  const context = useQuery({
    queryKey: ["market", "context", session.user.id],
    queryFn: readMarketContext,
  });
  const businesses = context.data?.businesses ?? [];
  const selected =
    businesses.find((entry) => entry.id === choice) ?? businesses[0];
  return (
    <section className="market-stack">
      <Link to="/account/sign-in">Account settings</Link>
      <BusinessForm />
      {context.isPending && <p role="status">Loading your businesses</p>}
      {context.isError && (
        <button className="outline" onClick={() => void context.refetch()}>
          Retry businesses
        </button>
      )}
      {!!businesses.length && (
        <label>
          Active business
          <select
            value={selected?.id}
            onChange={(event) => setChoice(event.target.value)}
          >
            {businesses.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} ({entry.role})
              </option>
            ))}
          </select>
        </label>
      )}
      {selected && (
        <BusinessCatalogue
          key={selected.id}
          business={selected}
          user={session.user.id}
        />
      )}
    </section>
  );
}
export default function MarketStudio() {
  return (
    <MarketGate title="Seller Studio">
      {(session) => <><Link className="outline" to="/business/journey">Seller enquiries</Link><Link className="outline" to="/business/insights">Seller insights</Link><Studio key={session.user.id} session={session} /></>}
    </MarketGate>
  );
}
