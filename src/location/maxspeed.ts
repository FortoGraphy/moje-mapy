/** Implicit national limits (km/h) used by OSM `maxspeed=XX:zone` values. */
const ZONES: Record<string, Record<string, number>> = {
  CZ: { urban: 50, rural: 90, trunk: 110, motorway: 130, living_street: 20, pedestrian_zone: 20, walk: 6 },
  SK: { urban: 50, rural: 90, trunk: 130, motorway: 130, living_street: 20 },
  AT: { urban: 50, rural: 100, trunk: 100, motorway: 130, living_street: 5, bicycle_road: 30 },
  PL: { urban: 50, rural: 90, expressway: 120, motorway: 140, living_street: 20 },
  DE: { urban: 50, rural: 100, motorway: 130, living_street: 7, bicycle_road: 30 },
  HU: { urban: 50, rural: 90, trunk: 110, motorway: 130, living_street: 20 },
};

/** Parses an OSM maxspeed value to km/h. Returns null for "none", "signals" or unknown values. */
export function parseMaxspeed(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().split(";")[0];
  const mph = /^(\d+(?:\.\d+)?)\s*mph$/i.exec(s);
  if (mph) return Math.round(Number(mph[1]) * 1.609);
  const n = /^(\d+(?:\.\d+)?)(\s*km\/h)?$/i.exec(s);
  if (n) return Number(n[1]);
  if (s === "walk") return 6;
  const zone = /^([A-Z]{2}):(.+)$/.exec(s);
  if (zone) return ZONES[zone[1]]?.[zone[2]] ?? null;
  return null;
}
