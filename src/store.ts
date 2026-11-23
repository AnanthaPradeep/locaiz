import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SourcingRequest } from "./sourcing/catalog";

export type Activity = {
  id: string;
  title: string;
  detail: string;
  date: string;
  status?: string;
  sourcing?: SourcingRequest;
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
  ) => void;
  update: (collection: Collection, id: string, status: string) => void;
};

export const useDemo = create<DemoState>()(
  persist(
    (set) => ({
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
      add: (collection, title, detail, status, sourcing) =>
        set((state) => ({
          [collection]: [
            {
              id: crypto.randomUUID(),
              title,
              detail,
              date: new Date().toISOString(),
              status,
              sourcing,
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
