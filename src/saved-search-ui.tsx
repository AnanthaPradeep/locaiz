import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link, useLocation } from "react-router-dom";
import { useDemo } from "./store";
import {
  scopeNames,
  searchUrl,
  snapshot,
  type Criteria,
  type Scope,
} from "./saved-search";

export function MatchCheck() {
  const { pathname } = useLocation();
  const check = useDemo((state) => state.checkMatches);
  useEffect(() => {
    check();
  }, [check, pathname]);
  useEffect(() => useDemo.persist.onFinishHydration(check), [check]);
  return null;
}

function SearchEditor({
  scope,
  params,
  id,
  name = "",
  enabled = true,
  label,
  edit,
}: {
  scope: Scope;
  params: URLSearchParams;
  id?: string;
  name?: string;
  enabled?: boolean;
  label: string;
  edit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const save = useDemo((state) => state.saveSearch);
  const selected = [...params].filter(
    ([key]) => !["page", "view", "sort", "editSearch"].includes(key),
  );
  const suggested = (
    params.get("q")?.trim() ||
    params.get("category") ||
    scopeNames[scope]
  ).slice(0, 80);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const next = new URLSearchParams(params);
      if (edit) {
        for (const key of new Set(selected.map(([key]) => key)))
          next.delete(key);
        selected.forEach(([key], index) => {
          const value = String(data.get("filter-" + index) ?? "").trim();
          if (value) next.append(key, value);
        });
        if (!params.has("q") && data.get("keywords"))
          next.set("q", String(data.get("keywords")).trim());
      }
      save(
        snapshot(scope, next),
        String(data.get("name")),
        data.has("alerts"),
        id,
      );
      setStatus(id ? "Saved search updated." : "Search saved.");
      setOpen(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save this search.",
      );
    }
  }
  return (
    <>
      <span className="saved-feedback" role="status">
        {status}
      </span>
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          setError("");
          setOpen(value);
        }}
      >
        <Dialog.Trigger asChild>
          <button className="outline">{label}</button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="saved-overlay" />
          <Dialog.Content className="saved-dialog record">
            <Dialog.Title>
              {id ? "Edit saved search" : "Save this search"}
            </Dialog.Title>
            <Dialog.Description>
              Demo Mode · Saved in this browser
            </Dialog.Description>
            <form className="saved-stack" onSubmit={submit}>
              <label>
                Search name
                <input
                  name="name"
                  required
                  maxLength={80}
                  defaultValue={name || suggested}
                />
              </label>
              {edit ? (
                <>
                  {!params.has("q") && (
                    <label>
                      Keywords
                      <input name="keywords" maxLength={180} />
                    </label>
                  )}
                  {selected.map(([key, value], index) => (
                    <label key={key + index}>
                      {filterName(key)}
                      <input
                        name={"filter-" + index}
                        defaultValue={value}
                        maxLength={180}
                      />
                    </label>
                  ))}
                </>
              ) : (
                <CriteriaSummary
                  criteria={{
                    scope,
                    query: params.toString(),
                    preferences: "",
                  }}
                />
              )}
              <label>
                <input type="checkbox" name="alerts" defaultChecked={enabled} />{" "}
                Enable in-app match alerts
              </label>
              {error && <p role="alert">{error}</p>}
              <div className="actions">
                <button className="solid" type="submit">
                  Save search
                </button>
                <Dialog.Close asChild>
                  <button type="button" className="outline">
                    Cancel
                  </button>
                </Dialog.Close>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

const names: Record<string, string> = {
  q: "Keywords",
  maxPrice: "Maximum price (₹)",
  minPrice: "Minimum price (₹)",
  maxMoq: "Maximum MOQ",
  role: "Supplier type",
  method: "Purchase method",
  place: "Location",
  destination: "Ships to",
  countryOfSupplier: "Supplier country",
  supplierCity: "Supplier city",
  pickup: "Pickup",
  custom: "Custom orders",
};
const filterName = (key: string) =>
  names[key] ??
  key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
function CriteriaSummary({ criteria }: { criteria: Criteria }) {
  return (
    <div className="actions">
      {[...new URLSearchParams(criteria.query)]
        .filter(
          ([key]) => !["page", "view", "sort", "editSearch"].includes(key),
        )
        .map(([key, value], index) => (
          <span className="saved-chip" key={index}>
            {filterName(key)}{" "}
            {value === "1" && ["pickup", "custom"].includes(key)
              ? "offered"
              : value}
          </span>
        ))}
    </div>
  );
}

export function SavedSearchButton({
  scope,
  params,
}: {
  scope: Scope;
  params: URLSearchParams;
}) {
  const editing = useDemo((state) =>
    state.savedSearches.find(
      (search) =>
        search.id === params.get("editSearch") && search.scope === scope,
    ),
  );
  return (
    <div className="actions saved-controls">
      <SearchEditor
        scope={scope}
        params={params}
        label={editing ? "Update saved search" : "Save this search"}
        id={editing?.id}
        name={editing?.name}
        enabled={editing?.enabled}
      />
      <Link to="/account/saved-searches">Saved searches</Link>
    </div>
  );
}

export function SavedSearches() {
  const searches = useDemo((state) => state.savedSearches);
  const alerts = useDemo((state) => state.matchAlerts);
  const save = useDemo((state) => state.saveSearch);
  const remove = useDemo((state) => state.deleteSearch);
  const check = useDemo((state) => state.checkMatches);
  const published = useDemo((state) => state.includeAlertSample);
  const publish = useDemo((state) => state.publishAlertSamples);
  const [feedback, setFeedback] = useState("");
  const { hash } = useLocation();
  useEffect(() => {
    if (hash)
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ block: "center" });
  }, [hash]);
  return (
    <section className="saved-stack">
      <p>
        Demo Mode · Checks run while you use LOCAIZ. Searches and alerts are
        stored on this browser.
      </p>
      <details className="record">
        <summary>Demo match simulator</summary>
        <p>
          Try saving "Alabaster Match Demo Lamp" in Shop or "Demo restock offer"
          in Global Atlas before publishing these two sample entries.
        </p>
        <button className="outline" disabled={published} onClick={publish}>
          {published ? "Demo samples published" : "Publish demo samples"}
        </button>
      </details>
      {!searches.length && (
        <div className="record saved-stack">
          <p>No saved searches yet.</p>
          <div className="actions">
            <Link to="/shop">Explore products</Link>
            <Link to="/sourcing">Search global suppliers</Link>
          </div>
        </div>
      )}
      {!!searches.length && (
        <div className="actions">
          <button
            className="outline"
            onClick={() => {
              try {
                check();
                setFeedback("Match check complete.");
              } catch {
                setFeedback("The match check failed. Try again.");
              }
            }}
          >
            Check for new matches
          </button>
          <span role="status">{feedback}</span>
        </div>
      )}
      {searches.map((search) => {
        const unread = alerts.filter(
          (alert) => alert.searchId === search.id && !alert.read,
        ).length;
        return (
          <article
            className="record saved-stack"
            key={search.id}
            id={search.id}
          >
            <h3>{search.name}</h3>
            <p>
              {scopeNames[search.scope]} ·{" "}
              {search.enabled ? "Active" : "Paused"} ·{" "}
              {unread ? unread + " unread matches" : "No unread matches"}
            </p>
            <CriteriaSummary criteria={search} />
            <p className="muted">
              Last checked{" "}
              <time dateTime={search.checked}>
                {new Date(search.checked).toLocaleString()}
              </time>
            </p>
            <div className="actions">
              <Link className="solid" to={searchUrl(search)}>
                Open search
              </Link>
              <SearchEditor
                scope={search.scope}
                params={
                  new URLSearchParams(
                    [search.query, search.preferences]
                      .filter(Boolean)
                      .join("&"),
                  )
                }
                id={search.id}
                name={search.name}
                enabled={search.enabled}
                label="Edit"
                edit
              />
              <Link
                className="outline"
                to={searchUrl(search) + "&editSearch=" + search.id}
              >
                Edit using search filters
              </Link>
              <button
                className="outline"
                onClick={() =>
                  save(search, search.name, !search.enabled, search.id)
                }
              >
                {search.enabled ? "Pause" : "Resume"}
              </button>
              <Dialog.Root>
                <Dialog.Trigger asChild>
                  <button className="outline">Delete</button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="saved-overlay" />
                  <Dialog.Content className="saved-dialog record saved-stack">
                    <Dialog.Title>Delete saved search</Dialog.Title>
                    <Dialog.Description>
                      Delete {search.name} and its match alerts?
                    </Dialog.Description>
                    <div className="actions">
                      <Dialog.Close asChild>
                        <button className="outline">Cancel</button>
                      </Dialog.Close>
                      <button
                        className="solid"
                        onClick={() => remove(search.id)}
                      >
                        Delete search
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function MatchAlerts() {
  const alerts = useDemo((state) => state.matchAlerts);
  const read = useDemo((state) => state.readMatches);
  const unread = alerts.filter((alert) => !alert.read).length;
  return (
    <section className="saved-stack saved-controls" aria-label="Match alerts">
      <h2>Match alerts</h2>
      <p>{unread} unread · Demo Mode</p>
      {!!unread && (
        <div>
          <button className="outline" onClick={() => read()}>
            Mark all match alerts as read
          </button>
        </div>
      )}
      {!alerts.length && <p>No new matches yet.</p>}
      {alerts.map((alert) => (
        <article className="record saved-stack" key={alert.key}>
          <h3>{alert.title}</h3>
          <p>
            {alert.reason} · {alert.read ? "Read" : "Unread"}
          </p>
          <time dateTime={alert.date}>
            {new Date(alert.date).toLocaleString()}
          </time>
          <div className="actions">
            <Link to={alert.href} onClick={() => read(alert.key)}>
              View match
            </Link>
            <Link to={"/account/saved-searches#" + alert.searchId}>
              {alert.searchName}
            </Link>
            {!alert.read && (
              <button className="outline" onClick={() => read(alert.key)}>
                Mark as read
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
