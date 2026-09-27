import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import { addWaypoint, appendPoints, createRide, type RidePoint, updateRideStats } from "@/db/rides";
import { uid } from "@/utils/format";
import { bboxOf, cumulativeDistances, elevationGain, haversine, simplify } from "@/utils/geo";
import { parseGpx } from "@/utils/gpx";

/** Lets the user pick a .gpx file and stores it as an imported ride. Returns the new ride id. */
export async function importGpxFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["application/gpx+xml", "application/octet-stream", "text/xml", "application/xml", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const xml = new File(asset.uri).textSync();
  const gpx = parseGpx(xml);
  const src = gpx.tracks.length ? gpx.tracks : gpx.routes;
  const points = src.flatMap((t, segment) => t.points.map((p) => ({ ...p, segment })));
  if (points.length < 2) throw new Error("GPX neobsahuje žádnou stopu");

  const id = uid("ride");
  const name = gpx.name ?? asset.name.replace(/\.gpx$/i, "");
  const t0 = points[0].time ?? Date.now();
  createRide(id, name, t0, "imported");

  const rows: RidePoint[] = points.map((p, i) => ({
    seq: i,
    segment: p.segment,
    lat: p.lat,
    lon: p.lon,
    alt: p.ele ?? null,
    speed: null,
    course: null,
    accuracy: null,
    ts: p.time ?? t0 + i * 1000,
  }));
  // Derive speeds from timestamps when the file has them.
  let maxSpeed = 0;
  let moving = 0;
  const timed = points.every((p) => p.time != null);
  if (timed) {
    for (let i = 1; i < rows.length; i++) {
      const dt = (rows[i].ts - rows[i - 1].ts) / 1000;
      if (dt <= 0 || rows[i].segment !== rows[i - 1].segment) continue;
      const v = haversine([rows[i - 1].lon, rows[i - 1].lat], [rows[i].lon, rows[i].lat]) / dt;
      rows[i].speed = v;
      if (v > 0.8) moving += dt;
      if (v < 70) maxSpeed = Math.max(maxSpeed, v);
    }
  }
  appendPoints(id, rows);

  const coords = rows.map((r) => [r.lon, r.lat] as [number, number]);
  const cum = cumulativeDistances(coords);
  const eles = rows.map((r) => r.alt).filter((a): a is number => a != null);
  const { up, down } = elevationGain(eles, 4);
  const last = rows[rows.length - 1];
  updateRideStats(id, {
    ended_at: timed ? last.ts : null,
    distance: cum[cum.length - 1],
    moving_time: moving,
    total_time: timed ? (last.ts - rows[0].ts) / 1000 : 0,
    max_speed: maxSpeed,
    ascent: up,
    descent: down,
    max_alt: eles.length ? eles.reduce((m, e) => (e > m ? e : m), -Infinity) : null,
    bbox: JSON.stringify(bboxOf(coords)),
    preview: JSON.stringify(simplify(coords, 25).slice(0, 400)),
    finished: 1,
  });
  for (const w of gpx.waypoints) {
    addWaypoint({
      id: uid("w"),
      ride_id: id,
      lat: w.lat,
      lon: w.lon,
      alt: w.ele ?? null,
      ts: w.time ?? t0,
      name: w.name ?? null,
      photo_uri: null,
    });
  }
  return id;
}
