import { create } from "zustand";

import type { LngLat, Place } from "@/types";

export type FollowMode = "off" | "follow" | "heading" | "course";
export type Panel = "home" | "search" | "place" | "planner" | "nav";

interface UiState {
  follow: FollowMode;
  panel: Panel;
  /** panel to return to when the place card closes */
  back: Panel;
  menuOpen: boolean;
  /** place shown in the place card (POI tap, search result, long-press pin) */
  place: Place | null;
  /** long-press pin location (rendered as a pin even while the card is open) */
  droppedPin: LngLat | null;
  center: LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
  /** what the map currently renders from */
  source: { region: string | null; outdoor: boolean };

  setFollow: (f: FollowMode) => void;
  setPanel: (p: Panel) => void;
  setMenuOpen: (open: boolean) => void;
  showPlace: (p: Place, opts?: { pin?: boolean }) => void;
  clearPlace: () => void;
  setView: (v: { center: LngLat; zoom: number; bearing: number; pitch: number }) => void;
}

export const useUi = create<UiState>()((set) => ({
  follow: "follow",
  panel: "home",
  back: "home",
  menuOpen: false,
  place: null,
  droppedPin: null,
  center: [15.47, 49.8],
  zoom: 6.5,
  bearing: 0,
  pitch: 0,
  source: { region: null, outdoor: false },

  setFollow: (follow) => set({ follow }),
  setPanel: (panel) => set({ panel }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  showPlace: (place, opts) =>
    set((s) => ({
      place,
      panel: "place",
      back: s.panel === "planner" || s.panel === "nav" ? s.panel : s.panel === "place" ? s.back : "home",
      droppedPin: opts?.pin ? [place.lon, place.lat] : null,
    })),
  clearPlace: () => set((s) => ({ place: null, droppedPin: null, panel: s.panel === "place" ? s.back : s.panel })),
  setView: (v) => set(v),
}));
