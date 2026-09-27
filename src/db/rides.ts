import { db } from "./index";

export interface RideRow {
  id: string;
  name: string;
  source: "recorded" | "imported";
  started_at: number;
  ended_at: number | null;
  distance: number;
  moving_time: number;
  total_time: number;
  max_speed: number;
  ascent: number;
  descent: number;
  max_alt: number | null;
  bbox: string | null;
  preview: string | null;
  finished: number;
}

export interface RidePoint {
  seq: number;
  segment: number;
  lat: number;
  lon: number;
  alt: number | null;
  speed: number | null;
  course: number | null;
  accuracy: number | null;
  ts: number;
}

export interface WaypointRow {
  id: string;
  ride_id: string;
  lat: number;
  lon: number;
  alt: number | null;
  ts: number;
  name: string | null;
  photo_uri: string | null;
}

export function createRide(id: string, name: string, startedAt: number, source: RideRow["source"] = "recorded") {
  db.runSync("INSERT INTO rides (id, name, source, started_at) VALUES (?, ?, ?, ?)", id, name, source, startedAt);
}

export function appendPoints(rideId: string, points: RidePoint[]) {
  if (!points.length) return;
  db.withTransactionSync(() => {
    const stmt = db.prepareSync(
      "INSERT OR REPLACE INTO ride_points (ride_id, seq, segment, lat, lon, alt, speed, course, accuracy, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    try {
      for (const p of points) {
        stmt.executeSync(rideId, p.seq, p.segment, p.lat, p.lon, p.alt, p.speed, p.course, p.accuracy, p.ts);
      }
    } finally {
      stmt.finalizeSync();
    }
  });
}

export function updateRideStats(id: string, s: Partial<Omit<RideRow, "id">>) {
  const keys = Object.keys(s) as (keyof typeof s)[];
  if (!keys.length) return;
  const sql = `UPDATE rides SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
  db.runSync(sql, ...keys.map((k) => (s[k] ?? null) as string | number | null), id);
}

export function listRides(): RideRow[] {
  return db.getAllSync<RideRow>("SELECT * FROM rides WHERE finished = 1 ORDER BY started_at DESC");
}

export function getRide(id: string): RideRow | null {
  return db.getFirstSync<RideRow>("SELECT * FROM rides WHERE id = ?", id);
}

export function unfinishedRide(): RideRow | null {
  return db.getFirstSync<RideRow>("SELECT * FROM rides WHERE finished = 0 ORDER BY started_at DESC LIMIT 1");
}

export function getRidePoints(id: string): RidePoint[] {
  return db.getAllSync<RidePoint>(
    "SELECT seq, segment, lat, lon, alt, speed, course, accuracy, ts FROM ride_points WHERE ride_id = ? ORDER BY seq",
    id,
  );
}

export function lastPoint(id: string): RidePoint | null {
  return db.getFirstSync<RidePoint>(
    "SELECT seq, segment, lat, lon, alt, speed, course, accuracy, ts FROM ride_points WHERE ride_id = ? ORDER BY seq DESC LIMIT 1",
    id,
  );
}

export function deleteRide(id: string) {
  db.withTransactionSync(() => {
    db.runSync("DELETE FROM ride_points WHERE ride_id = ?", id);
    db.runSync("DELETE FROM waypoints WHERE ride_id = ?", id);
    db.runSync("DELETE FROM rides WHERE id = ?", id);
  });
}

export function renameRide(id: string, name: string) {
  db.runSync("UPDATE rides SET name = ? WHERE id = ?", name, id);
}

export function addWaypoint(w: WaypointRow) {
  db.runSync(
    "INSERT INTO waypoints (id, ride_id, lat, lon, alt, ts, name, photo_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    w.id, w.ride_id, w.lat, w.lon, w.alt, w.ts, w.name, w.photo_uri,
  );
}

export function getWaypoints(rideId: string): WaypointRow[] {
  return db.getAllSync<WaypointRow>("SELECT * FROM waypoints WHERE ride_id = ? ORDER BY ts", rideId);
}
