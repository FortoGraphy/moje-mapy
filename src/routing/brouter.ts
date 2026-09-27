import { CONFIG } from "@/config";
import { parseMaxspeed } from "@/location/maxspeed";
import { useSettings } from "@/store/settings";
import type { Maneuver, ManeuverType, ProfileId, Route, RouteSegment, SurfaceClass } from "@/types";
import { uid } from "@/utils/format";
import { bboxOf, cumulativeDistances, elevationGain, haversine } from "@/utils/geo";

import { BUILTIN, type CustomProfile, CUSTOM_PROFILES, profileSource } from "./profiles";

const TIMEOUT = 30_000;
const uploaded = new Map<string, string>();

function base(): string {
  return (useSettings.getState().brouterUrl || CONFIG.brouterUrl).replace(/\/$/, "");
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": CONFIG.userAgent } });
  } finally {
    clearTimeout(timer);
  }
}

async function serverProfile(profile: ProfileId, force = false): Promise<string> {
  const builtin = BUILTIN[profile];
  if (builtin) return builtin;
  const respect = useSettings.getState().respectAccess;
  const key = `${base()}|${profile}|${respect}`;
  if (!force && uploaded.has(key)) return uploaded.get(key)!;
  const res = await fetchWithTimeout(`${base()}/profile`, {
    method: "POST",
    body: profileSource(profile as CustomProfile, respect),
  });
  const json = (await res.json()) as { profileid?: string; error?: string };
  if (!json.profileid) throw new Error(json.error ?? "profile upload failed");
  uploaded.set(key, json.profileid);
  return json.profileid;
}

const HINT: Record<number, ManeuverType> = {
  1: "straight",
  2: "left",
  3: "slightLeft",
  4: "sharpLeft",
  5: "right",
  6: "slightRight",
  7: "sharpRight",
  8: "keepLeft",
  9: "keepRight",
  10: "uturn",
  11: "uturn",
  12: "uturn",
  13: "offRoute",
  14: "roundabout",
  15: "roundabout",
  16: "straight",
  17: "keepLeft",
  18: "keepRight",
  100: "arrive",
};

const UNPAVED = /surface=(unpaved|gravel|fine_gravel|compacted|dirt|earth|ground|grass|sand|mud|pebblestone|rock)/;
const PAVED = /surface=(paved|asphalt|concrete|paving_stones|sett)/;

export function classifySurface(wayTags: string): SurfaceClass {
  const hw = /highway=(\S+)/.exec(wayTags)?.[1];
  if (hw === "track") {
    const g = /tracktype=(grade[1-5])/.exec(wayTags)?.[1] as SurfaceClass | undefined;
    if (g) return g;
    if (PAVED.test(wayTags)) return "paved";
    return UNPAVED.test(wayTags) ? "gravel" : "unknown";
  }
  if (hw && /^(path|footway|bridleway|cycleway|steps|pedestrian)$/.test(hw)) return "path";
  if (UNPAVED.test(wayTags)) return "gravel";
  return "paved";
}

/** Typical riding speeds (km/h) of a light enduro, used for the ETA instead of BRouter's car model. */
function segmentSpeed(s: RouteSegment): number {
  const hw = s.highway ?? "";
  let v: number;
  switch (s.surface) {
    case "grade1": v = 40; break;
    case "grade2": v = 35; break;
    case "grade3": v = 26; break;
    case "grade4": v = 18; break;
    case "grade5": v = 12; break;
    case "path": v = 10; break;
    case "gravel": v = 30; break;
    case "unknown": v = 24; break;
    default:
      v = /motorway/.test(hw) ? 100 : /trunk/.test(hw) ? 85 : /primary/.test(hw) ? 70 : /secondary/.test(hw) ? 62
        : /tertiary/.test(hw) ? 55 : /unclassified|road/.test(hw) ? 45 : /residential|living/.test(hw) ? 30 : 25;
  }
  if (s.maxspeed) v = Math.min(v, s.maxspeed);
  return v;
}

interface BRouterFeature {
  geometry: { coordinates: [number, number, number][] };
  properties: {
    "track-length": string;
    "filtered ascend": string;
    "total-time": string;
    messages: string[][];
    voicehints?: number[][];
  };
}

function parse(f: BRouterFeature, profile: ProfileId, via: [number, number][]): Route {
  const coords = f.geometry.coordinates.map((c) => [c[0], c[1], c[2] ?? 0] as [number, number, number]);
  const cumDist = cumulativeDistances(coords);
  const distance = cumDist[cumDist.length - 1] ?? Number(f.properties["track-length"]);

  const segments: RouteSegment[] = [];
  let last = 0;
  for (const row of f.properties.messages.slice(1)) {
    const lon = Number(row[0]) / 1e6;
    const lat = Number(row[1]) / 1e6;
    let j = last;
    let best = Infinity;
    for (let k = last; k < coords.length; k++) {
      const d = Math.abs(coords[k][0] - lon) + Math.abs(coords[k][1] - lat);
      if (d < best) {
        best = d;
        j = k;
      }
      if (d < 3e-6) break;
    }
    const tags = row[9] ?? "";
    if (j > last) {
      segments.push({
        from: last,
        to: j,
        surface: classifySurface(tags),
        highway: /highway=(\S+)/.exec(tags)?.[1],
        maxspeed: parseMaxspeed(/maxspeed=(\S+)/.exec(tags)?.[1]) ?? undefined,
      });
      last = j;
    }
  }
  if (last < coords.length - 1) {
    const prev = segments[segments.length - 1];
    if (prev) prev.to = coords.length - 1;
    else segments.push({ from: 0, to: coords.length - 1, surface: "unknown" });
  }

  const maneuvers: Maneuver[] = [{ type: "depart", index: 0, at: 0 }];
  for (const h of f.properties.voicehints ?? []) {
    const [index, cmd, exit] = h;
    const type = HINT[cmd];
    if (!type || type === "straight" || type === "offRoute" || type === "arrive") continue;
    if (index <= 0 || index >= coords.length - 1) continue;
    maneuvers.push({
      type,
      index,
      at: cumDist[index],
      exit: type === "roundabout" && exit ? Math.abs(exit) : undefined,
    });
  }
  maneuvers.push({ type: "arrive", index: coords.length - 1, at: distance });

  const legEnds: number[] = [];
  let from = 0;
  for (const v of via.slice(1)) {
    let bi = from;
    let bd = Infinity;
    for (let k = from; k < coords.length; k++) {
      const d = haversine(v, [coords[k][0], coords[k][1]]);
      if (d < bd) {
        bd = d;
        bi = k;
      }
    }
    legEnds.push(bi);
    from = bi;
  }
  legEnds[legEnds.length - 1] = coords.length - 1;

  const { up, down } = elevationGain(coords.map((c) => c[2]));
  const moto = (CUSTOM_PROFILES as string[]).includes(profile);
  const duration = moto
    ? segments.reduce((s, seg) => s + ((cumDist[seg.to] - cumDist[seg.from]) / 1000 / segmentSpeed(seg)) * 3600, 0)
    : Number(f.properties["total-time"]);

  return {
    id: uid("r"),
    profile,
    coords,
    cumDist,
    distance,
    duration,
    ascent: Number(f.properties["filtered ascend"]) || up,
    descent: down,
    segments,
    maneuvers,
    legEnds,
    bbox: bboxOf(coords),
  };
}

async function request(coords: [number, number][], profile: ProfileId, alt: number, retry = true): Promise<Route> {
  const pid = await serverProfile(profile);
  const lonlats = coords.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join("|");
  const url = `${base()}?lonlats=${lonlats}&profile=${encodeURIComponent(pid)}&alternativeidx=${alt}&format=geojson&timode=3`;
  const res = await fetchWithTimeout(url);
  const text = await res.text();
  if (!res.ok || !text.startsWith("{")) {
    if (retry && /profile/i.test(text) && !BUILTIN[profile]) {
      await serverProfile(profile, true);
      return request(coords, profile, alt, false);
    }
    throw new Error(text.trim().slice(0, 160) || `BRouter HTTP ${res.status}`);
  }
  const json = JSON.parse(text) as { features: BRouterFeature[] };
  return parse(json.features[0], profile, coords);
}

function similar(a: Route, b: Route): boolean {
  if (Math.abs(a.distance - b.distance) / Math.max(a.distance, 1) > 0.03) return false;
  const step = Math.max(1, Math.floor(a.coords.length / 20));
  let far = 0;
  for (let i = 0; i < a.coords.length; i += step) {
    const p: [number, number] = [a.coords[i][0], a.coords[i][1]];
    let min = Infinity;
    for (let j = 0; j < b.coords.length; j += 3) min = Math.min(min, haversine(p, [b.coords[j][0], b.coords[j][1]]));
    if (min > 60) far++;
  }
  return far <= 1;
}

export async function computeRoutes(
  coords: [number, number][],
  profile: ProfileId,
  opts: { alternatives: boolean },
): Promise<Route[]> {
  const main = await request(coords, profile, 0);
  if (!opts.alternatives) return [main];
  const alts = await Promise.allSettled([request(coords, profile, 1), request(coords, profile, 2)]);
  const out = [main];
  for (const a of alts) {
    if (a.status === "fulfilled" && !out.some((r) => similar(r, a.value))) out.push(a.value);
  }
  return out;
}

/** Single route for rerouting during navigation (no alternatives). */
export async function computeRoute(coords: [number, number][], profile: ProfileId): Promise<Route> {
  return request(coords, profile, 0);
}
