import { create } from "zustand";

import { type DownloadedRegion, listDownloadedRegions } from "@/db/regions";

import { type Catalog, cachedCatalog, fetchCatalog } from "./catalog";

export interface DownloadProgress {
  regionId: string;
  bytes: number;
  total: number;
  state: "queued" | "downloading" | "paused" | "error";
  error?: string;
}

interface OfflineState {
  catalog: Catalog | null;
  catalogError: string | null;
  catalogLoading: boolean;
  downloaded: DownloadedRegion[];
  downloads: Record<string, DownloadProgress>;

  loadCatalog: (force?: boolean) => Promise<void>;
  refreshDownloaded: () => void;
  setProgress: (p: DownloadProgress) => void;
  clearProgress: (regionId: string) => void;
}

export const useOffline = create<OfflineState>()((set, get) => ({
  catalog: null,
  catalogError: null,
  catalogLoading: false,
  downloaded: [],
  downloads: {},

  loadCatalog: async (force = false) => {
    if (get().catalogLoading) return;
    if (!get().catalog) set({ catalog: cachedCatalog() });
    if (get().catalog && !force) {
      // refresh silently in the background
      fetchCatalog().then((c) => c && set({ catalog: c, catalogError: null })).catch(() => {});
      return;
    }
    set({ catalogLoading: true });
    try {
      const c = await fetchCatalog();
      set({ catalog: c ?? get().catalog, catalogError: null });
    } catch (e) {
      set({ catalogError: String(e) });
    } finally {
      set({ catalogLoading: false });
    }
  },

  refreshDownloaded: () => set({ downloaded: listDownloadedRegions() }),

  setProgress: (p) => set((s) => ({ downloads: { ...s.downloads, [p.regionId]: p } })),
  clearProgress: (regionId) =>
    set((s) => {
      const { [regionId]: _, ...rest } = s.downloads;
      return { downloads: rest };
    }),
}));
