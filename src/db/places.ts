import type { Place } from "@/types";

import { db } from "./index";

interface PlaceRow {
  id: string;
  name: string;
  subtitle: string | null;
  lat: number;
  lon: number;
  category: string | null;
}

const toPlace = (r: PlaceRow): Place => ({
  id: r.id,
  name: r.name,
  subtitle: r.subtitle ?? undefined,
  lat: r.lat,
  lon: r.lon,
  category: r.category ?? undefined,
});

export function listSavedPlaces(): Place[] {
  return db.getAllSync<PlaceRow>("SELECT * FROM places ORDER BY created_at DESC").map(toPlace);
}

export function isPlaceSaved(id: string): boolean {
  return !!db.getFirstSync("SELECT id FROM places WHERE id = ?", id);
}

export function savePlace(p: Place) {
  db.runSync(
    "INSERT OR REPLACE INTO places (id, name, subtitle, lat, lon, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    p.id, p.name, p.subtitle ?? null, p.lat, p.lon, p.category ?? null, Date.now(),
  );
}

export function removePlace(id: string) {
  db.runSync("DELETE FROM places WHERE id = ?", id);
}

export function listRecent(limit = 12): Place[] {
  return db
    .getAllSync<PlaceRow>("SELECT * FROM recent_searches ORDER BY used_at DESC LIMIT ?", limit)
    .map(toPlace);
}

export function pushRecent(p: Place) {
  db.runSync(
    "INSERT OR REPLACE INTO recent_searches (id, name, subtitle, lat, lon, category, used_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    p.id, p.name, p.subtitle ?? null, p.lat, p.lon, p.category ?? null, Date.now(),
  );
  db.runSync(
    "DELETE FROM recent_searches WHERE id NOT IN (SELECT id FROM recent_searches ORDER BY used_at DESC LIMIT 50)",
  );
}

export function clearRecent() {
  db.runSync("DELETE FROM recent_searches");
}
