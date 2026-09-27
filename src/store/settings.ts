import { create } from "zustand";
import { persist } from "zustand/middleware";

import { CONFIG } from "@/config";
import type { LangSetting } from "@/i18n";
import { POI_CATEGORIES, type PoiCategory } from "@/map/poiCategories";
import type { ProfileId } from "@/types";

import { kvStorage } from "./storage";

export type MapStyleId = "enduro" | "road" | "topo";
export type OverlayId = "hillshade" | "contours" | "tracks" | "access" | "buildings3d" | "poi";
export type Units = "metric" | "imperial";

export interface Trip {
  distance: number;
  movingTime: number;
  stoppedTime: number;
  maxSpeed: number;
  since: number;
}

const emptyTrip = (): Trip => ({ distance: 0, movingTime: 0, stoppedTime: 0, maxSpeed: 0, since: Date.now() });

interface SettingsState {
  language: LangSetting;
  units: Units;
  mapStyle: MapStyleId;
  overlays: Record<OverlayId, boolean>;
  poiCategories: Record<PoiCategory, boolean>;
  textScale: number;
  rotateWithHeading: boolean;
  tilt3d: boolean;
  preferOffline: boolean;
  voice: boolean;
  speedAlert: boolean;
  speedTolerance: number;
  respectAccess: boolean;
  autoPause: boolean;
  keepAwake: boolean;
  brouterUrl: string;
  lastProfile: ProfileId;
  trips: { a: Trip; b: Trip };
  lastCamera: { center: [number, number]; zoom: number } | null;

  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  toggleOverlay: (id: OverlayId) => void;
  togglePoiCategory: (id: PoiCategory) => void;
  resetTrip: (which: "a" | "b") => void;
  addToTrips: (delta: { distance: number; moving: number; stopped: number; speed: number }) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: "system",
      units: "metric",
      mapStyle: "enduro",
      overlays: {
        hillshade: true,
        contours: true,
        tracks: true,
        access: true,
        buildings3d: false,
        poi: true,
      },
      poiCategories: Object.fromEntries(POI_CATEGORIES.map((c) => [c, true])) as Record<PoiCategory, boolean>,
      textScale: 1,
      rotateWithHeading: false,
      tilt3d: false,
      preferOffline: true,
      voice: true,
      speedAlert: true,
      speedTolerance: 5,
      respectAccess: true,
      autoPause: true,
      keepAwake: true,
      brouterUrl: CONFIG.brouterUrl,
      lastProfile: "enduro",
      trips: { a: emptyTrip(), b: emptyTrip() },
      lastCamera: null,

      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      toggleOverlay: (id) => set((s) => ({ overlays: { ...s.overlays, [id]: !s.overlays[id] } })),
      togglePoiCategory: (id) =>
        set((s) => ({ poiCategories: { ...s.poiCategories, [id]: !s.poiCategories[id] } })),
      resetTrip: (which) => set((s) => ({ trips: { ...s.trips, [which]: emptyTrip() } })),
      addToTrips: ({ distance, moving, stopped, speed }) =>
        set((s) => {
          const upd = (t: Trip): Trip => ({
            distance: t.distance + distance,
            movingTime: t.movingTime + moving,
            stoppedTime: t.stoppedTime + stopped,
            maxSpeed: Math.max(t.maxSpeed, speed),
            since: t.since,
          });
          return { trips: { a: upd(s.trips.a), b: upd(s.trips.b) } };
        }),
    }),
    {
      name: "settings-v1",
      storage: kvStorage,
      partialize: ({ set: _s, toggleOverlay: _t, togglePoiCategory: _p, resetTrip: _r, addToTrips: _a, ...rest }) => rest,
    },
  ),
);
