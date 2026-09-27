import type { ProfileId, RoutePoint } from "@/types";

import { db } from "./index";

export interface SavedRouteRow {
  id: string;
  name: string;
  profile: ProfileId;
  created_at: number;
  distance: number;
  duration: number;
  ascent: number;
  points: string;
  geometry: string;
}

export interface SavedRoute extends Omit<SavedRouteRow, "points" | "geometry"> {
  points: RoutePoint[];
  geometry: [number, number, number][];
}

function parse(r: SavedRouteRow): SavedRoute {
  return { ...r, points: JSON.parse(r.points), geometry: JSON.parse(r.geometry) };
}

export function saveRoute(r: SavedRoute) {
  db.runSync(
    "INSERT OR REPLACE INTO routes (id, name, profile, created_at, distance, duration, ascent, points, geometry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    r.id, r.name, r.profile, r.created_at, r.distance, r.duration, r.ascent,
    JSON.stringify(r.points), JSON.stringify(r.geometry),
  );
}

export function listRoutes(): SavedRoute[] {
  return db.getAllSync<SavedRouteRow>("SELECT * FROM routes ORDER BY created_at DESC").map(parse);
}

export function getRoute(id: string): SavedRoute | null {
  const r = db.getFirstSync<SavedRouteRow>("SELECT * FROM routes WHERE id = ?", id);
  return r ? parse(r) : null;
}

export function deleteRoute(id: string) {
  db.runSync("DELETE FROM routes WHERE id = ?", id);
}
