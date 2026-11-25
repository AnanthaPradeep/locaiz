import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "./page";
import { asset, products, type Listing } from "./catalog";
import {
  compareImages,
  imageDescriptor,
  sampleSize,
  validateVisualFile,
  type Descriptor,
} from "./visual-similarity";

const candidates = products.filter((item) => item.image);
const categories = [...new Set(candidates.map((item) => item.category))].sort();
type Match = { item: Listing; distance: number };
const photo = (item: Listing) => asset("images/" + item.image + ".webp");

async function describe(input: Blob | HTMLImageElement) {
  const bitmap = await createImageBitmap(input, {
    resizeWidth: sampleSize,
    resizeHeight: sampleSize,
    resizeQuality: "high",
  });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context)
      throw new Error("Image processing is unavailable in this browser.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, sampleSize, sampleSize);
    context.drawImage(bitmap, 0, 0);
    return imageDescriptor(
      context.getImageData(0, 0, sampleSize, sampleSize).data,
    );
  } finally {
    bitmap.close();
  }
}

async function catalogDescriptor(item: Listing) {
  const image = new Image();
  image.src = photo(item);
  await image.decode();
  return describe(image);
}
export default function VisualSearch() {
  const [preview, setPreview] = useState("");
  const [source, setSource] = useState<Descriptor>();
  const [matches, setMatches] = useState<Match[]>();
  const [category, setCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [error, setError] = useState("");
  const [selecting, setSelecting] = useState(false);
  const cache = useRef(new Map<string, Descriptor>());
  const generation = useRef(0);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const results = candidates.filter(
    (item) =>
      (!category || item.category === category) &&
      (!keyword.trim() ||
        [item.name, item.category, item.detail]
          .join(" ")
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())),
  );
  function remove() {
    generation.current++;
    setSource(undefined);
    setPreview("");
    setMatches(undefined);
    setError("");
    setProgress(undefined);
    setSelecting(false);
  }
  async function select(file: File) {
    remove();
    const request = generation.current;
    setSelecting(true);
    try {
      await validateVisualFile(file);
      const descriptor = await describe(file);
      if (request !== generation.current) return;
      setSource(descriptor);
      setPreview(URL.createObjectURL(file));
    } catch (reason) {
      if (request === generation.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to read the image.",
        );
    } finally {
      if (request === generation.current) setSelecting(false);
    }
  }
  async function search() {
    if (!source || progress) return;
    const request = generation.current;
    setError("");
    setMatches(undefined);
    if (!results.length) {
      setMatches([]);
      return;
    }
    setProgress({ done: 0, total: results.length });
    const items: Match[] = [];
    for (let start = 0; start < results.length; start += 4) {
      const parsed = await Promise.allSettled(
        results.slice(start, start + 4).map(async (item) => {
          const descriptor =
            cache.current.get(item.id) ?? (await catalogDescriptor(item));
          cache.current.set(item.id, descriptor);
          return { item, distance: compareImages(source, descriptor) };
        }),
      );
      if (request !== generation.current) return;
      for (const result of parsed)
        if (result.status === "fulfilled") items.push(result.value);
      setProgress({
        done: Math.min(start + 4, results.length),
        total: results.length,
      });
    }
    setProgress(undefined);
    if (!items.length) {
      setError("Catalogue photos could not be loaded. Try again.");
      return;
    }
    setMatches(
      items
        .filter((item) => item.distance <= 0.45)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 12),
    );
  }
  const choose = (file?: File) => {
    if (file) void select(file);
  };
  return (
    <Page
      title="Search by image"
      intro="Compare your photo with the sample Shop catalogue."
    >
      <div className="journey-stack">
        <section
          className="journey-panel journey-form"
          aria-label="Image search controls"
        >
          <p>
            Your photo stays in this browser and the preview is removed when you
            leave. Only catalogue photos are fetched for comparison.
          </p>
          <label>
            Choose product photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                choose(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <label>
            Take product photo
            <input
              type="file"
              capture="environment"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                choose(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {selecting && <p role="status">Preparing preview</p>}
          {preview && (
            <div>
              <img
                src={preview}
                alt="Selected product preview"
                width={240}
                height={180}
                style={{ objectFit: "contain", maxWidth: "100%" }}
              />
              <button className="outline" onClick={remove}>
                Remove photo
              </button>
            </div>
          )}
          <div className="journey-fields">
            <label>
              Refine by text
              <input
                type="search"
                value={keyword}
                disabled={Boolean(progress)}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setMatches(undefined);
                }}
              />
            </label>
            <label>
              Category
              <select
                value={category}
                disabled={Boolean(progress)}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setMatches(undefined);
                }}
              >
                <option value="">All categories</option>
                {categories.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="button"
            disabled={!source || Boolean(progress)}
            onClick={() => void search()}
          >
            Find similar products
          </button>
          {progress && (
            <label>
              Comparing catalogue photos{" "}
              <progress value={progress.done} max={progress.total} />
            </label>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
        {matches && (
          <section className="journey-panel" aria-label="Visual matches">
            <h2>Visual matches</h2>
            <p>
              Appearance alone cannot establish compatibility. For industrial
              parts, verify dimensions, material grade, and engineering
              specifications with the supplier.
            </p>
            {matches.length === 0 && (
              <p>
                No similar photos found. Try a different image or change the
                filters.
              </p>
            )}
            <div className="market-grid">
              {matches.map(({ item }) => (
                <article key={item.id} className="record market-stack">
                  <img
                    className="market-photo"
                    src={photo(item)}
                    alt=""
                    width={300}
                    height={225}
                    loading="lazy"
                  />
                  <h3>
                    <Link to={"/listing/shop/" + item.id}>{item.name}</Link>
                  </h3>
                  <p>{item.category}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </Page>
  );
}
