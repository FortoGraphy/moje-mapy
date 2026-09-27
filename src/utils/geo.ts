import type { LngLat } from "@/types";

const R = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a: LngLat, b: LngLat): number {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLon = toRad(b[0] - a[0]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function angleDiff(a: number, b: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return d;
}

export function cumulativeDistances(coords: ArrayLike<readonly number[]>): number[] {
  const out = new Array<number>(coords.length);
  let acc = 0;
  out[0] = 0;
  for (let i = 1; i < coords.length; i++) {
    acc += haversine(coords[i - 1] as unknown as LngLat, coords[i] as unknown as LngLat);
    out[i] = acc;
  }
  return out;
}

export function bboxOf(coords: ArrayLike<readonly number[]>): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    if (c[0] < w) w = c[0];
    if (c[0] > e) e = c[0];
    if (c[1] < s) s = c[1];
    if (c[1] > n) n = c[1];
  }
  return [w, s, e, n];
}

export function inBbox(p: LngLat, b: readonly number[]): boolean {
  return p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
}

/** Ray casting point-in-polygon for GeoJSON Polygon / MultiPolygon coordinates. */
export function inPolygon(p: LngLat, geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): boolean {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    let inside = false;
    for (let r = 0; r < poly.length; r++) {
      const ring = poly[r];
      let ringInside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) ringInside = !ringInside;
      }
      if (r === 0) inside = ringInside;
      else if (ringInside) inside = false;
    }
    if (inside) return true;
  }
  return false;
}

export interface Projection {
  /** segment index i (between coords[i] and coords[i+1]) */
  index: number;
  /** 0..1 position within the segment */
  t: number;
  point: LngLat;
  /** perpendicular distance in meters */
  distance: number;
  /** distance along the line from start in meters */
  along: number;
}

/**
 * Projects a point onto a polyline. Uses a local equirectangular approximation, which is precise
 * enough for the few-hundred-meter distances involved in route snapping.
 */
export function projectOnLine(
  p: LngLat,
  coords: ArrayLike<readonly number[]>,
  cumDist: number[],
  fromIndex = 0,
  toIndex = coords.length - 1,
): Projection | null {
  if (coords.length < 2) return null;
  const kx = Math.cos(toRad(p[1])) * 111320;
  const ky = 110540;
  let best: Projection | null = null;
  const start = Math.max(0, fromIndex);
  const end = Math.min(coords.length - 1, toIndex);
  for (let i = start; i < end; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky;
    const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy;
    const d = Math.sqrt(px * px + py * py);
    if (!best || d < best.distance) {
      best = {
        index: i,
        t,
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        distance: d,
        along: cumDist[i] + (cumDist[i + 1] - cumDist[i]) * t,
      };
    }
  }
  return best;
}

/** Douglas-Peucker simplification in meters (approximate). */
export function simplify<T extends readonly number[]>(coords: T[], toleranceM: number): T[] {
  if (coords.length < 3) return coords;
  const kx = Math.cos(toRad(coords[0][1])) * 111320;
  const ky = 110540;
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack: [number, number][] = [[0, coords.length - 1]];
  const tol2 = toleranceM * toleranceM;
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const ax = coords[s][0] * kx, ay = coords[s][1] * ky;
    const bx = coords[e][0] * kx, by = coords[e][1] * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const px = coords[i][0] * kx, py = coords[i][1] * ky;
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const qx = ax + t * dx - px, qy = ay + t * dy - py;
      const d = qx * qx + qy * qy;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol2 && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

export function pointAlong(coords: ArrayLike<readonly number[]>, cumDist: number[], along: number): LngLat {
  if (along <= 0) return [coords[0][0], coords[0][1]];
  const last = coords.length - 1;
  if (along >= cumDist[last]) return [coords[last][0], coords[last][1]];
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] <= along) lo = mid;
    else hi = mid;
  }
  const seg = cumDist[hi] - cumDist[lo];
  const t = seg > 0 ? (along - cumDist[lo]) / seg : 0;
  return [
    coords[lo][0] + (coords[hi][0] - coords[lo][0]) * t,
    coords[lo][1] + (coords[hi][1] - coords[lo][1]) * t,
  ];
}

export function elevationGain(eles: number[], threshold = 3): { up: number; down: number } {
  let up = 0, down = 0;
  if (!eles.length) return { up, down };
  let ref = eles[0];
  for (let i = 1; i < eles.length; i++) {
    const d = eles[i] - ref;
    if (d >= threshold) { up += d; ref = eles[i]; }
    else if (d <= -threshold) { down -= d; ref = eles[i]; }
  }
  return { up, down };
}
