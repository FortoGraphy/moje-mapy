import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import { haptic } from "@/components/ui";
import { t } from "@/i18n";
import { acquireBackground, releaseBackground } from "@/location/background";
import { useLocation } from "@/location/store";
import { cameraRef } from "@/map/controller";
import { computeRoute } from "@/routing/brouter";
import { useRouting } from "@/routing/store";
import { useSettings } from "@/store/settings";
import { useUi } from "@/store/ui";
import type { Fix, LngLat, Maneuver, ProfileId, Route } from "@/types";
import { haversine, pointAlong, projectOnLine } from "@/utils/geo";
import { isOnline } from "@/utils/online";

import { type NavMode, type NavProgress, useNav } from "./store";
import { concatRoutes, sliceRoute, trackToRoute } from "./trackRoute";
import { announceText, speak, stopSpeech } from "./voice";

const KEEP_AWAKE_TAG = "navigation";
const REROUTE_EVERY = 12_000;
const ARRIVE_RADIUS = 30;

interface Session {
  mode: NavMode;
  profile: ProfileId;
  /** remaining stops (route mode), last one is the destination */
  stops: LngLat[];
  /** full GPX track (track mode) */
  track: Route | null;
  /** where the current route joins the track: route metres before it, track metres at it */
  join: { routeAt: number; trackAt: number };
  lastIndex: number;
  offCount: number;
  lastReroute: number;
  /** maneuver index -> highest announced stage */
  announced: Map<number, number>;
  unsub: () => void;
}

let s: Session | null = null;

function stopsOf(route: Route): LngLat[] {
  return route.legEnds.map((i) => [route.coords[i][0], route.coords[i][1]]);
}

function nextManeuver(route: Route, along: number): [Maneuver | null, Maneuver | null] {
  const ms = route.maneuvers;
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    if (m.type === "depart" || m.at <= along + 3) continue;
    return [m, ms[i + 1] ?? null];
  }
  return [null, null];
}

function segmentMaxspeed(route: Route, index: number): number | null {
  const segs = route.segments;
  let lo = 0, hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].to <= index) lo = mid + 1;
    else if (segs[mid].from > index) hi = mid - 1;
    else return segs[mid].maxspeed ?? null;
  }
  return null;
}

function initialCamera() {
  const fix = useLocation.getState().fix;
  const pitch = useSettings.getState().tilt3d ? 50 : 0;
  if (fix) cameraRef.current?.easeTo({ center: [fix.lon, fix.lat], zoom: 16.5, pitch, duration: 600 });
  setTimeout(() => useUi.getState().setFollow("course"), 650);
}

function begin(route: Route, mode: NavMode, track: Route | null, join = { routeAt: 0, trackAt: 0 }) {
  s?.unsub();
  const unsub = useLocation.subscribe((st, prev) => {
    if (st.fix && st.fix !== prev.fix) onFix(st.fix);
  });
  s = {
    mode,
    profile: route.profile,
    stops: stopsOf(route),
    track,
    join,
    lastIndex: 0,
    offCount: 0,
    lastReroute: 0,
    announced: new Map(),
    unsub,
  };
  useNav.setState({ active: true, mode, route, progress: null, offRoute: false, rerouting: false, arrived: false });
  useUi.setState({ panel: "nav", place: null, droppedPin: null });
  activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
  acquireBackground("navigation").catch(() => {});
  initialCamera();

  const [first] = nextManeuver(route, 0);
  speak(t("nav.voice.start", { action: first ? announceText(first, first.at) : t("nav.maneuver.straight") }), {
    interrupt: true,
  });
  if (first) s.announced.set(first.index, first.at > 160 ? 0 : 1);
  const fix = useLocation.getState().fix;
  if (fix) onFix(fix);
}

export function startNavigation(route: Route) {
  begin(route, "route", null);
}

/**
 * Follows a GPX track. When the rider is away from its start, a BRouter approach leg to the
 * start is prepended (if online).
 */
export async function startTrackNavigation(coords: [number, number, number][]) {
  const profile = useSettings.getState().lastProfile;
  const track = trackToRoute(coords, profile);
  const fix = useLocation.getState().fix;
  const start: LngLat = [coords[0][0], coords[0][1]];
  if (fix && haversine([fix.lon, fix.lat], start) > 150 && isOnline()) {
    try {
      const approach = await computeRoute([[fix.lon, fix.lat], start], profile);
      begin(concatRoutes(approach, track), "track", track, { routeAt: approach.distance, trackAt: 0 });
      return;
    } catch {
      // fall through: navigate the bare track, the banner shows the distance to it
    }
  }
  begin(track, "track", track);
}

export function stopNavigation() {
  s?.unsub();
  s = null;
  stopSpeech();
  deactivateKeepAwake(KEEP_AWAKE_TAG);
  releaseBackground("navigation").catch(() => {});
  useNav.setState({ active: false, route: null, progress: null, offRoute: false, rerouting: false, arrived: false });
  useRouting.getState().clear();
  useUi.setState({ panel: "home" });
  const fix = useLocation.getState().fix;
  cameraRef.current?.easeTo({ center: fix ? [fix.lon, fix.lat] : useUi.getState().center, zoom: 15, pitch: 0, bearing: 0, duration: 600 });
  setTimeout(() => useUi.getState().setFollow("follow"), 650);
}

export function toggleMute() {
  const muted = !useNav.getState().muted;
  useNav.setState({ muted });
  if (muted) stopSpeech();
}

async function reroute(fix: Fix) {
  const sess = s;
  const nav = useNav.getState();
  if (!sess || !nav.route || nav.rerouting) return;
  sess.lastReroute = Date.now();
  if (!isOnline()) return;
  useNav.setState({ rerouting: true });
  speak(t("nav.voice.rerouting"), { interrupt: true });
  const me: LngLat = [fix.lon, fix.lat];
  const along = nav.progress?.along ?? 0;
  try {
    let route: Route;
    let join = { routeAt: 0, trackAt: 0 };
    if (sess.mode === "track" && sess.track) {
      const trackAlong = Math.max(0, sess.join.trackAt + (along - sess.join.routeAt));
      const rejoinAt = Math.min(sess.track.distance - 1, trackAlong + 150);
      const target = pointAlong(sess.track.coords, sess.track.cumDist, rejoinAt);
      const approach = await computeRoute([me, target], sess.profile);
      route = concatRoutes(approach, sliceRoute(sess.track, rejoinAt));
      join = { routeAt: approach.distance, trackAt: rejoinAt };
    } else {
      const leg = nav.progress?.leg ?? 0;
      route = await computeRoute([me, ...sess.stops.slice(leg)], sess.profile);
    }
    if (s !== sess) return;
    sess.join = join;
    sess.stops = stopsOf(route);
    sess.lastIndex = 0;
    sess.offCount = 0;
    sess.announced.clear();
    useNav.setState({ route, progress: null, offRoute: false, rerouting: false });
    onFix(fix);
  } catch {
    if (s === sess) useNav.setState({ rerouting: false });
  }
}

function announce(sess: Session, next: Maneuver, after: Maneuver | null, dist: number, speed: number) {
  const far = Math.max(450, speed * 30);
  const mid = Math.max(160, speed * 11);
  const now = Math.max(35, speed * 3.5);
  const stage = dist <= now ? 2 : dist <= mid ? 1 : dist <= far ? 0 : -1;
  if (stage < 0) return;
  const done = sess.announced.get(next.index) ?? -1;
  if (stage <= done) return;
  // Skip an early prompt when the next, closer one would follow within a few seconds.
  if (stage === 0 && dist < mid + speed * 6) return;
  if (stage === 1 && dist < now + speed * 4) return;
  sess.announced.set(next.index, stage);
  if (next.type === "arrive") {
    if (stage === 1) speak(announceText(next, dist));
    return;
  }
  const chain = after && after.type !== "arrive" && after.at - next.at < 120 ? after : null;
  if (stage === 2) {
    haptic.impact();
    speak(announceText(next, null, chain), { interrupt: true });
  } else {
    speak(announceText(next, dist, stage === 1 ? chain : null));
  }
}

function onFix(fix: Fix) {
  const sess = s;
  const nav = useNav.getState();
  const route = nav.route;
  if (!sess || !route || nav.rerouting) return;
  const p: LngLat = [fix.lon, fix.lat];

  let proj = projectOnLine(p, route.coords, route.cumDist, sess.lastIndex - 3, sess.lastIndex + 400);
  if (!proj || proj.distance > 40) {
    const full = projectOnLine(p, route.coords, route.cumDist);
    if (full && (!proj || full.distance < proj.distance - 10)) proj = full;
  }
  if (!proj) return;
  sess.lastIndex = proj.index;

  const threshold = Math.max(35, (fix.accuracy ?? 10) * 1.5 + 10);
  const off = proj.distance > threshold;
  sess.offCount = off ? sess.offCount + 1 : 0;
  const offRoute = sess.offCount >= 3;

  const along = proj.along;
  const remaining = Math.max(0, route.distance - along);
  const remainingTime = route.duration * (remaining / Math.max(1, route.distance));
  let leg = route.legEnds.findIndex((i) => route.cumDist[i] > along + ARRIVE_RADIUS);
  if (leg < 0) leg = route.legEnds.length - 1;
  const [next, after] = nextManeuver(route, along);
  const distToNext = next ? next.at - along : remaining;

  const prevLeg = nav.progress?.leg ?? 0;
  const progress: NavProgress = {
    along,
    snapped: proj.point,
    offset: proj.distance,
    next,
    after,
    distToNext,
    remaining,
    remainingTime,
    eta: Date.now() + remainingTime * 1000,
    leg,
    maxspeed: segmentMaxspeed(route, proj.index),
  };

  const arrived = !offRoute && remaining < ARRIVE_RADIUS;
  useNav.setState({ progress, offRoute, arrived: nav.arrived || arrived });

  if (arrived && !nav.arrived) {
    haptic.success();
    speak(t("nav.voice.arrive"), { interrupt: true });
    return;
  }
  if (!offRoute && leg > prevLeg && nav.progress) {
    haptic.success();
    speak(t("nav.voice.arriveStop"), { interrupt: true });
  }
  if (offRoute) {
    if (Date.now() - sess.lastReroute > REROUTE_EVERY) reroute(fix);
    return;
  }
  if (next && !nav.arrived) {
    const speed = fix.speed ?? useLocation.getState().displaySpeed ?? 8;
    announce(sess, next, after, distToNext, speed);
  }
}
