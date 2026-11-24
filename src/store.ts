import type { QuoteContext } from "./quote-evaluation";
import { compareMatches, evaluate, type Criteria, type MatchAlert, type SavedSearch } from "./saved-search";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SourcingRequest } from "./sourcing/catalog";

export type RequirementDetails = QuoteContext & { budget?: number; budgetCurrency?: string; specifications?: string };
export type QuoteDecision = {
  quoteId: string; supplierId: string; revision: number; quantity?: number;
  destination?: string; date: string; warnings: string[]; status: "selected";
};
export type QuoteWorkspace = {
  selected: string[]; shortlist: string[]; drafts: Record<string, string>;
  decisions: QuoteDecision[]; context?: QuoteContext;
};

export type Activity = {
  id: string;
  title: string;
  detail: string;
  date: string;
  status?: string;
  sourcing?: SourcingRequest;
  quoteContext?: RequirementDetails;
};
type Collection =
  | "orders"
  | "bookings"
  | "requirements"
  | "stock"
  | "messages"
  | "inventory"
  | "addresses"
  | "createdGroups";
type DemoState = Record<Collection, Activity[]> & {
  quoteWorkspaces: Record<string, QuoteWorkspace>;
  updateQuoteWorkspace: (id: string, update: (current: QuoteWorkspace) => QuoteWorkspace) => void;
  addBasketDemo: () => void;
  includeAlertSample: boolean;
  publishAlertSamples: () => void;
  savedSearches: SavedSearch[];
  matchAlerts: MatchAlert[];
  saveSearch: (criteria: Criteria, name: string, enabled: boolean, id?: string) => void;
  deleteSearch: (id: string) => void;
  checkMatches: () => void;
  readMatches: (key?: string) => void;
  cart: Record<string, number>;
  liked: string[];
  recent: string[];
  groups: Record<string, number>;
  groupDeadline: number;
  theme: "light" | "dark";
  city: string;
  profile: string;
  business: string;
  setCart: (id: string, quantity: number) => void;
  clearCart: () => void;
  checkout: (detail: string) => void;
  toggleLike: (id: string) => void;
  visit: (id: string) => void;
  join: (id: string, quantity: number) => void;
  setPreference: (
    patch: Partial<Pick<DemoState, "theme" | "city" | "profile" | "business">>,
  ) => void;
  add: (
    collection: Collection,
    title: string,
    detail: string,
    status?: string,
    sourcing?: SourcingRequest,
    quoteContext?: RequirementDetails,
  ) => void;
  update: (collection: Collection, id: string, status: string) => void;
};

export const useDemo = create<DemoState>()(
  persist(
    (set) => ({
      quoteWorkspaces: {},
      updateQuoteWorkspace: (id, update) => set((state) => {
        if (!state.requirements.some((request) => request.id === id)) return state;
        return { quoteWorkspaces: { ...state.quoteWorkspaces,
          [id]: update(state.quoteWorkspaces[id] ?? { selected: [], shortlist: [], drafts: {}, decisions: [] }),
        } };
      }),
      addBasketDemo: () => set((state) => {
        const id = "demo-basket-comparison";
        if (state.requirements.some((request) => request.id === id)) return state;
        const deadline = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
        return { requirements: [{ id, title: "50 handmade baskets", detail: "Demo wholesale requirement for Chennai",
          date: new Date().toISOString(), status: "Demo", quoteContext: { quantity: 50, destination: "Chennai",
          deadline, custom: true, budget: 12000, budgetCurrency: "INR" } }, ...state.requirements] };
      }),
      includeAlertSample: false,
      publishAlertSamples: () => set({ includeAlertSample: true }),
      savedSearches: [],
      matchAlerts: [],
      saveSearch: (criteria, title, enabled, id) => set((state) => {
        const name = title.trim();
        if (!name || name.length > 80) throw new Error("Enter a name of 1 to 80 characters.");
        if (state.savedSearches.some((entry) => entry.id !== id && entry.query === criteria.query && entry.scope === criteria.scope))
          throw new Error("You already saved this search.");
        const previous = state.savedSearches.find((entry) => entry.id === id);
        const changed = previous?.query !== criteria.query || previous.scope !== criteria.scope;
        const baseline = changed || (enabled && !previous?.enabled);
        const search = {
          ...criteria, name, enabled, id: previous?.id ?? crypto.randomUUID(),
          checked: baseline ? new Date().toISOString() : previous.checked,
          seen: baseline ? [...new Set([
            ...(changed ? [] : previous.seen),
            ...evaluate(criteria, state.groupDeadline > Date.now(), state.includeAlertSample).map(({ id }) => id),
          ])] : previous.seen,
          revision: (previous?.revision ?? 0) + Number(changed),
        };
        return { savedSearches: previous ? state.savedSearches.map((entry) => entry.id === id ? search : entry) : [search, ...state.savedSearches] };
      }),
      deleteSearch: (id) => set((state) => ({
        savedSearches: state.savedSearches.filter((entry) => entry.id !== id),
        matchAlerts: state.matchAlerts.filter((alert) => alert.searchId !== id),
      })),
      checkMatches: () => set((state) => {
        if (!state.savedSearches.some((search) => search.enabled)) return state;
        const date = new Date().toISOString();
        const alerts: MatchAlert[] = [];
        const savedSearches = state.savedSearches.map((search) => {
          if (!search.enabled) return search;
          const result = compareMatches(search, evaluate(search, state.groupDeadline > Date.now(), state.includeAlertSample), date);
          alerts.push(...result.alerts);
          return result.search;
        });
        const existing = new Set(state.matchAlerts.map(({ key }) => key));
        return { savedSearches, matchAlerts: [...alerts.filter(({ key }) => !existing.has(key)), ...state.matchAlerts] };
      }),
      readMatches: (key) => set((state) => ({
        matchAlerts: state.matchAlerts.map((alert) => !key || key === alert.key ? { ...alert, read: true } : alert),
      })),
      cart: {},
      liked: [],
      recent: [],
      groups: {},
      groupDeadline: Date.now() + 7 * 86400000,
      theme: "light",
      city: "Chennai",
      profile: "",
      business: "",
      orders: [],
      bookings: [],
      requirements: [],
      stock: [],
      messages: [],
      inventory: [],
      addresses: [],
      createdGroups: [],
      setCart: (id, quantity) =>
        set((state) => ({
          cart: { ...state.cart, [id]: Math.max(0, Math.min(99, quantity)) },
        })),
      clearCart: () => set({ cart: {} }),
      checkout: (detail) =>
        set((state) => {
          if (!Object.values(state.cart).some((quantity) => quantity > 0))
            return state;
          return {
            cart: {},
            orders: [
              {
                id: crypto.randomUUID(),
                title: "Demo retail order",
                detail,
                date: new Date().toISOString(),
                status: "Confirmed",
              },
              ...state.orders,
            ],
          };
        }),
      toggleLike: (id) =>
        set((state) => ({
          liked: state.liked.includes(id)
            ? state.liked.filter((item) => item !== id)
            : [...state.liked, id],
        })),
      visit: (id) =>
        set((state) => ({
          recent: [id, ...state.recent.filter((item) => item !== id)].slice(
            0,
            8,
          ),
        })),
      join: (id, quantity) =>
        set((state) => ({ groups: { ...state.groups, [id]: quantity } })),
      setPreference: (patch) => set(patch),
      add: (collection, title, detail, status, sourcing, quoteContext) =>
        set((state) => ({
          [collection]: [
            {
              id: crypto.randomUUID(),
              title,
              detail,
              date: new Date().toISOString(),
              status,
              sourcing,
              quoteContext,
            },
            ...state[collection],
          ],
        })),
      update: (collection, id, status) =>
        set((state) => ({
          [collection]: state[collection].map((item) =>
            item.id === id ? { ...item, status } : item,
          ),
        })),
    }),
    { name: "locaiz-demo-v1" },
  ),
);
