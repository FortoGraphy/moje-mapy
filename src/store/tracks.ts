import { create } from "zustand";

import { bboxOf } from "@/utils/geo";

export interface ViewTrack {
  id: string;
  name: string;
  /** [lon, lat, ele?] */
  coords: number[][];
  bbox: [number, number, number, number];
  waypoints?: { lon: number; lat: number; name: string; photo?: boolean }[];
}

interface TracksState {
  /** a saved ride / imported GPX shown on the main map */
  track: ViewTrack | null;
  show: (t: Omit<ViewTrack, "bbox">) => ViewTrack;
  clear: () => void;
}

export const useTracks = create<TracksState>()((set) => ({
  track: null,
  show: (t) => {
    const track = { ...t, bbox: bboxOf(t.coords) };
    set({ track });
    return track;
  },
  clear: () => set({ track: null }),
}));
