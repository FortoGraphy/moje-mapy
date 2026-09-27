import { create } from "zustand";

import type { Maneuver, Route } from "@/types";

export interface NavProgress {
  /** metres travelled along the route */
  along: number;
  /** snapped position on the route */
  snapped: [number, number];
  /** distance from the route in metres */
  offset: number;
  next: Maneuver | null;
  after: Maneuver | null;
  distToNext: number;
  remaining: number;
  remainingTime: number;
  eta: number;
  /** index of the next stop (leg) */
  leg: number;
  /** speed limit (km/h) of the current route segment, if known */
  maxspeed: number | null;
}

export type NavMode = "route" | "track";

interface NavState {
  active: boolean;
  mode: NavMode;
  route: Route | null;
  progress: NavProgress | null;
  offRoute: boolean;
  rerouting: boolean;
  muted: boolean;
  arrived: boolean;
}

export const useNav = create<NavState>()(() => ({
  active: false,
  mode: "route",
  route: null,
  progress: null,
  offRoute: false,
  rerouting: false,
  muted: false,
  arrived: false,
}));
