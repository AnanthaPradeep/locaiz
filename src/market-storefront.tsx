import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMarketMutation } from "./market-account";
import { formText, marketClient, uploadMarketFile } from "./market-foundation";

const fields =
  "maker_story,materials,production_capacity,cover_path,logo_path,workshop_path,is_public";
const imageFields = [
  ["cover_path", "Storefront cover"],
  ["logo_path", "Business logo"],
  ["workshop_path", "Workshop photograph"],
] as const;

function useStorefront(id: string, editing: boolean) {
  return useQuery({
    queryKey: ["market", "storefront", id, editing],
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("market_storefronts")
        .select(fields)
        .eq("business_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(id && marketClient),
  });
}

function StorefrontPhoto({
  path,
  alt,
  cover = false,
  logo = false,
}: {
  path: string;
  alt: string;
  cover?: boolean;
  logo?: boolean;
}) {
  const photo = useQuery({
    queryKey: ["market", "storefront-media", path],
    queryFn: async () => {
      const { data, error } = await marketClient!.storage
        .from("market-storefronts")
        .createSignedUrl(path, 60);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 45000,
    retry: false,
  });
  return photo.data ? (
    <img
      className={
        logo ? "storefront-logo" : cover ? "storefront-cover" : "market-photo"
      }
      src={photo.data}
      alt={alt}
      width={logo ? 96 : 600}
      height={logo ? 96 : cover ? 240 : 450}
      loading={cover ? "eager" : "lazy"}
    />
  ) : null;
}

export function StorefrontStory({
  id,
  name,
  verified,
}: {
  id: string;
  name: string;
  verified: boolean;
}) {
  const query = useStorefront(verified ? id : "", false);
  const page = query.data;
  if (!page?.is_public) return null;
  return (
    <section className="market-stack record" aria-label="Maker storefront">
      {page.cover_path && (
        <StorefrontPhoto
          path={page.cover_path}
          alt={name + " storefront cover"}
          cover
        />
      )}
      {page.logo_path && (
        <StorefrontPhoto path={page.logo_path} alt={name + " logo"} logo />
      )}
      <h2>About this business</h2>
      {page.maker_story && (
        <p className="journey-message">{page.maker_story}</p>
      )}
      {page.materials && (
        <>
          <h3>Materials and craftsmanship</h3>
          <p className="journey-message">{page.materials}</p>
        </>
      )}
      {page.production_capacity && (
        <>
          <h3>Production capacity</h3>
          <p className="journey-message">{page.production_capacity}</p>
        </>
      )}
      {page.workshop_path && (
        <StorefrontPhoto path={page.workshop_path} alt={name + " workshop"} />
      )}
    </section>
  );
}

export function StorefrontEditor({ id }: { id: string }) {
  const current = useStorefront(id, true);
  const mutation = useMarketMutation();
  const page = current.data;
  return (
    <details className="record">
      <summary>Edit maker storefront</summary>
      {current.isPending && <p role="status">Loading storefront</p>}
      {current.isError && (
        <p role="alert">
          Unable to load storefront.{" "}
          <button className="outline" onClick={() => void current.refetch()}>
            Retry storefront
          </button>
        </p>
      )}
      {current.isSuccess && (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = new FormData(form);
            void mutation.run(async () => {
              const files = imageFields.flatMap(([key]) => {
                const file = values.get(key);
                return file instanceof File && file.size ? [{ key, file }] : [];
              });
              const paths = {
                cover_path: page?.cover_path ?? null,
                logo_path: page?.logo_path ?? null,
                workshop_path: page?.workshop_path ?? null,
              };
              for (const [key] of imageFields)
                if (values.has("remove-" + key)) paths[key] = null;
              for (const { key, file } of files)
                paths[key] = await uploadMarketFile(
                  file,
                  id,
                  false,
                  "market-storefronts",
                );
              const { error } = await marketClient!
                .from("market_storefronts")
                .upsert({
                  business_id: id,
                  maker_story: formText(values, "story"),
                  materials: formText(values, "materials"),
                  production_capacity: formText(values, "capacity"),
                  is_public: values.has("publish"),
                  ...paths,
                });
              if (error) throw error;
              for (const input of form.querySelectorAll<HTMLInputElement>(
                "input[type=file]",
              ))
                input.value = "";
            }, "Storefront saved.");
          }}
        >
          <label>
            Maker story
            <textarea
              name="story"
              maxLength={3000}
              defaultValue={page?.maker_story}
            />
          </label>
          <label>
            Materials and craftsmanship
            <textarea
              name="materials"
              maxLength={1500}
              defaultValue={page?.materials}
            />
          </label>
          <label>
            Production capacity
            <textarea
              name="capacity"
              maxLength={500}
              defaultValue={page?.production_capacity}
            />
          </label>
          {imageFields.map(([key, label]) => (
            <div key={key}>
              <label>
                {label}
                <input
                  name={key}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
              </label>
              {page?.[key] && (
                <label>
                  <input type="checkbox" name={"remove-" + key} /> Remove
                  current {label.toLowerCase()}
                </label>
              )}
            </div>
          ))}
          <label>
            <input
              type="checkbox"
              name="publish"
              defaultChecked={page?.is_public}
            />{" "}
            Publish this story and these images once the business is verified
          </label>
          <button className="button" disabled={mutation.pending}>
            Save storefront
          </button>
          <Link to={"/supplier/" + id}>View supplier profile</Link>
          {mutation.feedback}
        </form>
      )}
    </details>
  );
}
