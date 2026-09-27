import { create } from "zustand";

import { useLocation } from "@/location/store";
import { useSettings } from "@/store/settings";
import type { Place, ProfileId, Route, RoutePoint } from "@/types";
import { uid } from "@/utils/format";

import { computeRoutes } from "./brouter";

export type RouteStatus = "idle" | "computing" | "ready" | "error";

interface RoutingState {
  points: RoutePoint[];
  profile: ProfileId;
  routes: Route[];
  selected: number;
  status: RouteStatus;
  error: string | null;

  /** Opens the planner: from my location to `dest` (or empty destination). */
  open: (dest?: Place | null) => void;
  setPoint: (index: number, place: Place | null, isMyLocation?: boolean) => void;
  addStop: (place?: Place | null) => void;
  removePoint: (index: number) => void;
  movePoint: (from: number, to: number) => void;
  reverse: () => void;
  setProfile: (p: ProfileId) => void;
  select: (i: number) => void;
  loadRoute: (points: RoutePoint[], profile: ProfileId) => void;
  clear: () => void;
  recompute: () => void;
}

const myLocation = (): RoutePoint => ({ key: uid("p"), place: null, isMyLocation: true });
const point = (place: Place | null): RoutePoint => ({ key: uid("p"), place });

let timer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

export function resolvePoint(p: RoutePoint): [number, number] | null {
  if (p.isMyLocation) {
    const f = useLocation.getState().fix;
    return f ? [f.lon, f.lat] : null;
  }
  return p.place ? [p.place.lon, p.place.lat] : null;
}

export const useRouting = create<RoutingState>()((set, get) => {
  const schedule = (delay = 250) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, delay);
  };

  const run = async () => {
    const { points, profile } = get();
    const coords = points.map(resolvePoint);
    if (coords.length < 2 || coords.some((c) => c == null)) {
      set({ routes: [], status: "idle", error: null });
      return;
    }
    const gen = ++generation;
    set({ status: "computing", error: null });
    try {
      const routes = await computeRoutes(coords as [number, number][], profile, {
        alternatives: points.length === 2,
      });
      if (gen !== generation) return;
      set({ routes, selected: 0, status: "ready" });
    } catch (e) {
      if (gen !== generation) return;
      set({ routes: [], status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const update = (points: RoutePoint[]) => {
    set({ points });
    schedule();
  };

  return {
    points: [],
    profile: useSettings.getState().lastProfile,
    routes: [],
    selected: 0,
    status: "idle",
    error: null,

    open: (dest) => {
      set({ profile: useSettings.getState().lastProfile, routes: [], selected: 0, error: null });
      update([myLocation(), point(dest ?? null)]);
    },
    setPoint: (index, place, isMyLocation) => {
      const pts = [...get().points];
      pts[index] = isMyLocation ? myLocation() : point(place);
      update(pts);
    },
    addStop: (place) => {
      const pts = [...get().points];
      if (pts.length === 0) {
        update([myLocation(), point(place ?? null)]);
        return;
      }
      const last = pts[pts.length - 1];
      if (!last.place && !last.isMyLocation) pts[pts.length - 1] = point(place ?? null);
      else pts.push(point(place ?? null));
      update(pts);
    },
    removePoint: (index) => {
      const pts = get().points.filter((_, i) => i !== index);
      while (pts.length < 2) pts.push(point(null));
      update(pts);
    },
    movePoint: (from, to) => {
      const pts = [...get().points];
      const [p] = pts.splice(from, 1);
      pts.splice(to, 0, p);
      update(pts);
    },
    reverse: () => update([...get().points].reverse()),
    setProfile: (profile) => {
      useSettings.getState().set("lastProfile", profile);
      set({ profile });
      schedule(0);
    },
    select: (selected) => set({ selected }),
    loadRoute: (points, profile) => {
      set({ profile, routes: [], selected: 0 });
      update(points.map((p) => ({ ...p, key: uid("p") })));
    },
    clear: () => {
      generation++;
      if (timer) clearTimeout(timer);
      set({ points: [], routes: [], selected: 0, status: "idle", error: null });
    },
    recompute: () => schedule(0),
  };
});
