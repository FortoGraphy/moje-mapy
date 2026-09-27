import { create } from "zustand";

/** Where a picked search result goes. */
export type SearchTarget = { kind: "place" } | { kind: "routePoint"; index: number } | { kind: "addStop" };

interface SearchState {
  target: SearchTarget;
  query: string;
  setQuery: (q: string) => void;
  setTarget: (t: SearchTarget) => void;
}

export const useSearch = create<SearchState>()((set) => ({
  target: { kind: "place" },
  query: "",
  setQuery: (query) => set({ query }),
  setTarget: (target) => set({ target, query: "" }),
}));
