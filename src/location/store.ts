import * as Location from "expo-location";
import { create } from "zustand";

import { useSettings } from "@/store/settings";
import type { Fix } from "@/types";
import { haversine } from "@/utils/geo";

export type Permission = "undetermined" | "granted" | "denied";

interface LocationState {
  permission: Permission;
  fix: Fix | null;
  /** compass heading (true north), null when unavailable */
  heading: number | null;
  /** smoothed grade in % over the last ~120 m */
  grade: number | null;
  /** accuracy worse than 30 m or no fix for 10 s */
  weak: boolean;
  /** metres/second, low-pass filtered for display */
  displaySpeed: number;
}

export const useLocation = create<LocationState>()(() => ({
  permission: "undetermined",
  fix: null,
  heading: null,
  grade: null,
  weak: false,
  displaySpeed: 0,
}));

const MOVING_SPEED = 1.2; // m/s ≈ 4.3 km/h
const gradeBuf: { d: number; alt: number }[] = [];
let travelled = 0;
let lastFix: Fix | null = null;

export function locationToFix(l: Location.LocationObject): Fix {
  const c = l.coords;
  return {
    lon: c.longitude,
    lat: c.latitude,
    alt: c.altitude ?? null,
    speed: c.speed != null && c.speed >= 0 ? c.speed : null,
    course: c.heading != null && c.heading >= 0 ? c.heading : null,
    accuracy: c.accuracy ?? null,
    altAccuracy: c.altitudeAccuracy ?? null,
    ts: l.timestamp,
  };
}

/**
 * Single entry point for all GPS fixes (foreground watcher and background recording task).
 * Updates live state and the persistent trip meters.
 */
export function ingestFix(fix: Fix) {
  if (lastFix && fix.ts <= lastFix.ts) return;
  const prev = lastFix;
  lastFix = fix;

  const good = fix.accuracy == null || fix.accuracy < 30;
  let speed = fix.speed;
  if (prev) {
    const dt = (fix.ts - prev.ts) / 1000;
    const d = haversine([prev.lon, prev.lat], [fix.lon, fix.lat]);
    if (speed == null && dt > 0) speed = d / dt;
    if (good && dt > 0 && dt < 120) {
      const moving = (speed ?? 0) >= MOVING_SPEED;
      const counted = moving && d < 200 * dt ? d : 0;
      travelled += counted;
      useSettings.getState().addToTrips({
        distance: counted,
        moving: moving ? dt : 0,
        stopped: moving ? 0 : dt,
        speed: good ? (speed ?? 0) : 0,
      });
      if (counted > 0 && fix.alt != null) {
        gradeBuf.push({ d: travelled, alt: fix.alt });
        while (gradeBuf.length > 2 && travelled - gradeBuf[1].d > 120) gradeBuf.shift();
      }
    }
  }

  let grade: number | null = useLocation.getState().grade;
  if (gradeBuf.length >= 2) {
    const a = gradeBuf[0];
    const b = gradeBuf[gradeBuf.length - 1];
    const dd = b.d - a.d;
    if (dd >= 40) grade = Math.max(-60, Math.min(60, ((b.alt - a.alt) / dd) * 100));
  }
  if ((speed ?? 0) < MOVING_SPEED) grade = null;

  const prevDisplay = useLocation.getState().displaySpeed;
  const target = speed ?? 0;
  const displaySpeed = target < 0.5 ? 0 : prevDisplay * 0.35 + target * 0.65;

  useLocation.setState({ fix: { ...fix, speed }, grade, weak: !good, displaySpeed });
}

let posSub: Location.LocationSubscription | null = null;
let headSub: Location.LocationSubscription | null = null;
let staleTimer: ReturnType<typeof setInterval> | null = null;

export async function requestForegroundPermission(): Promise<boolean> {
  const cur = await Location.getForegroundPermissionsAsync();
  let status = cur.status;
  if (status !== "granted" && cur.canAskAgain) status = (await Location.requestForegroundPermissionsAsync()).status;
  useLocation.setState({ permission: status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined" });
  return status === "granted";
}

export async function startForegroundWatch() {
  if (posSub) return;
  if (!(await requestForegroundPermission())) return;
  const last = await Location.getLastKnownPositionAsync().catch(() => null);
  if (last && !useLocation.getState().fix) useLocation.setState({ fix: locationToFix(last) });
  posSub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
    (l) => ingestFix(locationToFix(l)),
  );
  headSub = await Location.watchHeadingAsync((h) => {
    const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
    useLocation.setState({ heading: v });
  });
  staleTimer = setInterval(() => {
    const f = useLocation.getState().fix;
    if (f && Date.now() - f.ts > 10_000 && !useLocation.getState().weak) useLocation.setState({ weak: true });
  }, 5000);
}

export function stopForegroundWatch() {
  posSub?.remove();
  headSub?.remove();
  if (staleTimer) clearInterval(staleTimer);
  posSub = headSub = null;
  staleTimer = null;
}
