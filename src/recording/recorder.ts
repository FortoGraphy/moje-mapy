import { Directory, File, Paths } from "expo-file-system";
import * as Location from "expo-location";

import {
  addWaypoint,
  appendPoints,
  createRide,
  deleteRide,
  getRidePoints,
  lastPoint,
  type RidePoint,
  unfinishedRide,
  updateRideStats,
} from "@/db/rides";
import { currentLang } from "@/i18n";
import { acquireBackground, LOCATION_TASK, releaseBackground } from "@/location/background";
import { useLocation } from "@/location/store";
import { useSettings } from "@/store/settings";
import type { Fix } from "@/types";
import { uid } from "@/utils/format";
import { bboxOf, haversine, simplify } from "@/utils/geo";

import { initialRec, useRecording } from "./store";

const MAX_ACCURACY = 25;
const AUTO_PAUSE_SPEED = 0.8;
const AUTO_RESUME_SPEED = 2.0;
const AUTO_PAUSE_AFTER = 20_000;
const ELE_THRESHOLD = 4;
const FLUSH_EVERY = 15_000;
const TRACK_PUSH_EVERY = 3_000;

let unsub: (() => void) | null = null;
let seq = 0;
let segment = 0;
let buffer: RidePoint[] = [];
let lastFlush = 0;
let last: Fix | null = null;
let slowSince: number | null = null;
let eleRef: number | null = null;
let maxAlt: number | null = null;
let pendingTrack: [number, number][] = [];
let lastTrackPush = 0;

function rideName(ts: number): string {
  const d = new Date(ts);
  const cs = currentLang() === "cs";
  const date = d.toLocaleDateString(cs ? "cs-CZ" : "en-GB", { day: "numeric", month: "numeric" });
  const time = `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
  return `${cs ? "Jízda" : "Ride"} ${date} ${time}`;
}

function flush(force = false) {
  const st = useRecording.getState();
  if (!st.rideId) return;
  const now = Date.now();
  if (!force && buffer.length < 10 && now - lastFlush < FLUSH_EVERY) return;
  lastFlush = now;
  try {
    appendPoints(st.rideId, buffer);
    buffer = [];
    updateRideStats(st.rideId, {
      distance: st.distance,
      moving_time: st.movingTime,
      total_time: st.totalTime,
      max_speed: st.maxSpeed,
      ascent: st.ascent,
      descent: st.descent,
      max_alt: maxAlt,
    });
  } catch (e) {
    console.warn("recording flush", e);
  }
}

function subscribe() {
  unsub?.();
  unsub = useLocation.subscribe((s, prev) => {
    if (s.fix && s.fix !== prev.fix) onFix(s.fix);
  });
}

function onFix(fix: Fix) {
  const st = useRecording.getState();
  if (!st.rideId || st.status === "paused" || st.status === "idle") return;
  if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY) return;

  const prev = last;
  const dt = prev ? (fix.ts - prev.ts) / 1000 : 0;
  if (prev && dt <= 0) return;
  const d = prev ? haversine([prev.lon, prev.lat], [fix.lon, fix.lat]) : 0;
  const speed = fix.speed ?? (dt > 0 ? d / dt : 0);
  const now = fix.ts;

  let status = st.status;
  if (useSettings.getState().autoPause) {
    if (speed < AUTO_PAUSE_SPEED) {
      slowSince ??= now;
      if (status === "recording" && now - slowSince > AUTO_PAUSE_AFTER) status = "autopaused";
    } else {
      slowSince = null;
      if (status === "autopaused" && speed > AUTO_RESUME_SPEED) status = "recording";
    }
  } else if (status === "autopaused") {
    status = "recording";
  }

  const patch: Partial<typeof st> = { status, totalTime: st.totalTime + (dt < 300 ? dt : 0) };

  // Standing still produces GPS jitter; keep only points that really moved.
  const minMove = Math.max(3, (fix.accuracy ?? 5) * 0.5);
  if (prev && d < minMove && status !== "recording") {
    useRecording.setState(patch);
    return;
  }
  if (prev && d < minMove && speed < AUTO_PAUSE_SPEED) {
    useRecording.setState(patch);
    return;
  }

  if (status === "recording" && prev && d < 250 * Math.max(dt, 1)) {
    patch.distance = st.distance + d;
    if (speed >= AUTO_PAUSE_SPEED) patch.movingTime = st.movingTime + Math.min(dt, 30);
    if (speed < 70) patch.maxSpeed = Math.max(st.maxSpeed, speed);
  }

  if (fix.alt != null && (fix.altAccuracy == null || fix.altAccuracy < 15)) {
    maxAlt = maxAlt == null ? fix.alt : Math.max(maxAlt, fix.alt);
    if (eleRef == null) eleRef = fix.alt;
    const diff = fix.alt - eleRef;
    if (diff >= ELE_THRESHOLD) {
      patch.ascent = st.ascent + diff;
      eleRef = fix.alt;
    } else if (diff <= -ELE_THRESHOLD) {
      patch.descent = st.descent - diff;
      eleRef = fix.alt;
    }
  }

  last = fix;
  buffer.push({
    seq: seq++,
    segment,
    lat: fix.lat,
    lon: fix.lon,
    alt: fix.alt,
    speed,
    course: fix.course,
    accuracy: fix.accuracy,
    ts: fix.ts,
  });
  const tail = pendingTrack[pendingTrack.length - 1] ?? st.track[st.track.length - 1];
  if (!tail || haversine(tail, [fix.lon, fix.lat]) >= 4) pendingTrack.push([fix.lon, fix.lat]);
  // The map re-serializes the whole line on every change, so extend it at most every few seconds.
  if (pendingTrack.length && (st.track.length < 2 || now - lastTrackPush > TRACK_PUSH_EVERY)) {
    patch.track = [...st.track, ...pendingTrack];
    pendingTrack = [];
    lastTrackPush = now;
  }
  useRecording.setState(patch);
  flush();
}

/** Returns false when "Always" location is missing (recording then only works with the app open). */
export async function startRecording(): Promise<boolean> {
  if (useRecording.getState().rideId) return true;
  const id = uid("ride");
  const startedAt = Date.now();
  createRide(id, rideName(startedAt), startedAt);
  seq = 0;
  segment = 0;
  buffer = [];
  last = null;
  slowSince = null;
  eleRef = null;
  maxAlt = null;
  pendingTrack = [];
  lastTrackPush = 0;
  lastFlush = Date.now();
  useRecording.setState({ ...initialRec, status: "recording", rideId: id, startedAt });
  subscribe();
  const fix = useLocation.getState().fix;
  if (fix && Date.now() - fix.ts < 5000) onFix(fix);
  return acquireBackground("recording").catch(() => false);
}

export function pauseRecording() {
  if (!useRecording.getState().rideId) return;
  flush(true);
  useRecording.setState({ status: "paused" });
}

export function resumeRecording() {
  if (!useRecording.getState().rideId) return;
  segment++;
  last = null;
  slowSince = null;
  useRecording.setState({ status: "recording" });
}

function finalize(id: string) {
  const pts = getRidePoints(id);
  const coords = pts.map((p) => [p.lon, p.lat] as [number, number]);
  const st = useRecording.getState();
  updateRideStats(id, {
    ended_at: pts.length ? pts[pts.length - 1].ts : Date.now(),
    distance: st.distance,
    moving_time: st.movingTime,
    total_time: st.totalTime,
    max_speed: st.maxSpeed,
    ascent: st.ascent,
    descent: st.descent,
    max_alt: maxAlt,
    bbox: coords.length ? JSON.stringify(bboxOf(coords)) : null,
    preview: JSON.stringify(simplify(coords, 25).slice(0, 400)),
    finished: 1,
  });
}

/** Stops the ride. `save=false` discards it. Returns the ride id when saved. */
export async function stopRecording(save = true): Promise<string | null> {
  const st = useRecording.getState();
  const id = st.rideId;
  unsub?.();
  unsub = null;
  if (id) {
    flush(true);
    if (save && st.distance > 20) finalize(id);
    else deleteRide(id);
  }
  useRecording.setState({ ...initialRec });
  await releaseBackground("recording").catch(() => {});
  return id && save && st.distance > 20 ? id : null;
}

const PHOTO_DIR = "photos";

export function photoUri(rel: string | null): string | null {
  if (!rel) return null;
  return rel.startsWith("file:") ? rel : new File(Paths.document, rel).uri;
}

/** Adds a waypoint at the current position; `photo` is a temporary image URI to keep. */
export async function addRideWaypoint(name: string | null, photo?: string | null) {
  const st = useRecording.getState();
  const fix = useLocation.getState().fix;
  if (!st.rideId || !fix) return;
  const id = uid("w");
  let rel: string | null = null;
  if (photo) {
    const dir = new Directory(Paths.document, PHOTO_DIR);
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new File(dir, `${id}.jpg`);
    await new File(photo).copy(dest);
    rel = `${PHOTO_DIR}/${id}.jpg`;
  }
  addWaypoint({ id, ride_id: st.rideId, lat: fix.lat, lon: fix.lon, alt: fix.alt, ts: fix.ts, name, photo_uri: rel });
}

/** Called at app start: resumes an unfinished ride (e.g. after the app was killed). */
export async function restoreRecording() {
  const ride = unfinishedRide();
  if (!ride) return;
  const pts = getRidePoints(ride.id);
  const lp = lastPoint(ride.id);
  seq = lp ? lp.seq + 1 : 0;
  segment = lp ? lp.segment + 1 : 0;
  buffer = [];
  last = null;
  eleRef = null;
  maxAlt = ride.max_alt;
  pendingTrack = [];
  lastTrackPush = 0;
  lastFlush = Date.now();
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  const recent = lp != null && Date.now() - lp.ts < 10 * 60_000;
  useRecording.setState({
    status: running && recent ? "recording" : "paused",
    rideId: ride.id,
    startedAt: ride.started_at,
    distance: ride.distance,
    movingTime: ride.moving_time,
    totalTime: ride.total_time,
    maxSpeed: ride.max_speed,
    ascent: ride.ascent,
    descent: ride.descent,
    track: simplify(
      pts.map((p) => [p.lon, p.lat] as [number, number]),
      3,
    ),
  });
  subscribe();
  if (running) acquireBackground("recording").catch(() => {});
}
