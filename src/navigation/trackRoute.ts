import type { Maneuver, ManeuverType, ProfileId, Route } from "@/types";
import { uid } from "@/utils/format";
import { angleDiff, bboxOf, bearing, cumulativeDistances, elevationGain, pointAlong } from "@/utils/geo";

/** Index of the last coordinate at or before `along`. */
function indexAt(cumDist: number[], along: number): number {
  let lo = 0, hi = cumDist.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] <= along) lo = mid;
    else hi = mid;
  }
  return lo;
}

function turnType(delta: number): ManeuverType | null {
  const a = Math.abs(delta);
  const right = delta > 0;
  if (a < 30) return null;
  if (a < 50) return right ? "slightRight" : "slightLeft";
  if (a < 125) return right ? "right" : "left";
  if (a < 165) return right ? "sharpRight" : "sharpLeft";
  return "uturn";
}

/** Turn instructions for a plain GPX track, derived from sharp changes of direction. */
export function deriveManeuvers(coords: [number, number, number][], cumDist: number[]): Maneuver[] {
  const out: Maneuver[] = [{ type: "depart", index: 0, at: 0 }];
  const total = cumDist[cumDist.length - 1] ?? 0;
  const W = 25;
  let lastAt = -Infinity;
  let best: { i: number; d: number } | null = null;

  const flush = () => {
    if (!best) return;
    const type = turnType(best.d);
    if (type && cumDist[best.i] - lastAt > 40) {
      out.push({ type, index: best.i, at: cumDist[best.i] });
      lastAt = cumDist[best.i];
    }
    best = null;
  };

  for (let i = 1; i < coords.length - 1; i++) {
    const at = cumDist[i];
    if (at < W || at > total - W) continue;
    const a = pointAlong(coords, cumDist, at - W);
    const b = pointAlong(coords, cumDist, at + W);
    const p: [number, number] = [coords[i][0], coords[i][1]];
    const d = angleDiff(bearing(a, p), bearing(p, b));
    if (Math.abs(d) >= 30) {
      if (!best || Math.abs(d) > Math.abs(best.d)) best = { i, d };
    } else if (best && at - cumDist[best.i] > W) {
      flush();
    }
  }
  flush();
  out.push({ type: "arrive", index: coords.length - 1, at: total });
  return out;
}

export function trackToRoute(coords: [number, number, number][], profile: ProfileId, speedKmh = 28): Route {
  const cumDist = cumulativeDistances(coords);
  const distance = cumDist[cumDist.length - 1] ?? 0;
  const { up, down } = elevationGain(coords.map((c) => c[2]));
  return {
    id: uid("t"),
    profile,
    coords,
    cumDist,
    distance,
    duration: (distance / 1000 / speedKmh) * 3600,
    ascent: up,
    descent: down,
    segments: [{ from: 0, to: coords.length - 1, surface: "unknown" }],
    maneuvers: deriveManeuvers(coords, cumDist),
    legEnds: [coords.length - 1],
    bbox: bboxOf(coords),
  };
}

/** Part of a route from `along` metres to the end, as a new route. */
export function sliceRoute(r: Route, along: number): Route {
  if (along <= 0) return r;
  const i = indexAt(r.cumDist, along);
  const start = pointAlong(r.coords, r.cumDist, along);
  const ele = r.coords[i][2];
  const coords: [number, number, number][] = [[start[0], start[1], ele], ...r.coords.slice(i + 1)];
  const shift = (idx: number) => Math.max(0, idx - i);
  const cumDist = cumulativeDistances(coords);
  const out: Route = {
    ...r,
    id: uid("t"),
    coords,
    cumDist,
    distance: cumDist[cumDist.length - 1] ?? 0,
    duration: r.duration * (1 - along / Math.max(1, r.distance)),
    segments: r.segments.filter((s) => s.to > i).map((s) => ({ ...s, from: shift(s.from), to: shift(s.to) })),
    maneuvers: [
      { type: "depart", index: 0, at: 0 },
      ...r.maneuvers
        .filter((m) => m.index > i && m.type !== "depart")
        .map((m) => ({ ...m, index: shift(m.index), at: cumDist[shift(m.index)] })),
    ],
    legEnds: r.legEnds.filter((l) => l > i).map(shift),
    bbox: bboxOf(coords),
  };
  return out;
}

/** Joins an approach route with the route that follows it; the join point is not a stop. */
export function concatRoutes(a: Route, b: Route): Route {
  const off = a.coords.length - 1;
  const coords = [...a.coords, ...b.coords.slice(1)];
  const cumDist = cumulativeDistances(coords);
  return {
    id: uid("r"),
    profile: b.profile,
    coords,
    cumDist,
    distance: cumDist[cumDist.length - 1] ?? 0,
    duration: a.duration + b.duration,
    ascent: a.ascent + b.ascent,
    descent: a.descent + b.descent,
    segments: [
      ...a.segments,
      ...b.segments.map((s) => ({ ...s, from: s.from + off, to: s.to + off })),
    ],
    maneuvers: [
      ...a.maneuvers.filter((m) => m.type !== "arrive"),
      ...b.maneuvers
        .filter((m) => m.type !== "depart")
        .map((m) => ({ ...m, index: m.index + off, at: cumDist[m.index + off] })),
    ],
    legEnds: b.legEnds.map((l) => l + off),
    bbox: bboxOf(coords),
  };
}
