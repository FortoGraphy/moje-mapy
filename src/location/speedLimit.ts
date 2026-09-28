import * as Speech from "expo-speech";
import { AppState } from "react-native";
import { create } from "zustand";

import { haptic } from "@/components/ui";
import { speechLocale, t } from "@/i18n";
import { mapRef } from "@/map/controller";
import { MAXSPEED_QUERY_LAYER } from "@/map/style/overlays";
import { useNav } from "@/navigation/store";
import { useSettings } from "@/store/settings";
import { useUi } from "@/store/ui";
import { angleDiff, bearing } from "@/utils/geo";

import { parseMaxspeed } from "./maxspeed";
import { useLocation } from "./store";

interface LimitState {
  limit: number | null;
  speeding: boolean;
}

export const useSpeedLimit = create<LimitState>()(() => ({ limit: null, speeding: false }));

const QUERY_MIN_SPEED = 2; // m/s
let timer: ReturnType<typeof setInterval> | null = null;
let lastAlert = 0;
let lastFound = 0;

function lineBearingNear(coords: number[][], p: [number, number]): number | null {
  let best = Infinity;
  let b: number | null = null;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const c = coords[i];
    const mx = (a[0] + c[0]) / 2;
    const my = (a[1] + c[1]) / 2;
    const d = (mx - p[0]) ** 2 + (my - p[1]) ** 2;
    if (d < best) {
      best = d;
      b = bearing([a[0], a[1]], [c[0], c[1]]);
    }
  }
  return b;
}

async function queryMapLimit(): Promise<number | null | undefined> {
  const { fix, displaySpeed } = useLocation.getState();
  const map = mapRef.current;
  // queryRenderedFeatures runs on the UI thread; skip it when it cannot or need not find anything.
  if (!fix || !map || !useUi.getState().source.outdoor) return undefined;
  if (displaySpeed < QUERY_MIN_SPEED || AppState.currentState !== "active") {
    // Standing still: keep showing the last limit instead of letting it expire.
    lastFound = Date.now();
    return undefined;
  }
  try {
    const pt = await map.project([fix.lon, fix.lat]);
    const r = 18;
    const feats = await map.queryRenderedFeatures(
      [
        [pt[0] - r, pt[1] - r],
        [pt[0] + r, pt[1] + r],
      ],
      { layers: [MAXSPEED_QUERY_LAYER] },
    );
    let best: { v: number; score: number } | null = null;
    for (const f of feats) {
      const v = parseMaxspeed(f.properties?.maxspeed);
      if (v == null) continue;
      const g = f.geometry;
      const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
      let score = 90;
      if (fix.course != null) {
        for (const l of lines) {
          const b = lineBearingNear(l, [fix.lon, fix.lat]);
          if (b != null) {
            const d = Math.abs(angleDiff(b, fix.course));
            score = Math.min(score, Math.min(d, 180 - d));
          }
        }
      }
      if (!best || score < best.score) best = { v, score };
    }
    return best ? best.v : null;
  } catch {
    return undefined;
  }
}

async function tick() {
  const nav = useNav.getState();
  let limit: number | null | undefined = nav.active ? nav.progress?.maxspeed : undefined;
  if (limit == null) limit = await queryMapLimit();
  const now = Date.now();
  const prev = useSpeedLimit.getState().limit;
  if (limit != null) lastFound = now;
  // Keep the last known limit for a few seconds so it does not flicker at junctions.
  const value = limit ?? (now - lastFound < 8000 ? prev : null);

  const { speedAlert, speedTolerance, voice } = useSettings.getState();
  const speedKmh = (useLocation.getState().displaySpeed ?? 0) * 3.6;
  const speeding = value != null && speedKmh > value + speedTolerance;
  useSpeedLimit.setState({ limit: value, speeding });

  if (speeding && speedAlert && now - lastAlert > 45_000) {
    lastAlert = now;
    haptic.warn();
    if (voice && !nav.muted) Speech.speak(t("nav.voice.speeding"), { language: speechLocale() });
  }
}

export function startSpeedLimitWatcher() {
  if (timer) return;
  timer = setInterval(tick, 2000);
}

export function stopSpeedLimitWatcher() {
  if (timer) clearInterval(timer);
  timer = null;
}
