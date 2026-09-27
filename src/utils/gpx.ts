import { XMLParser } from "fast-xml-parser";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export interface GpxPoint {
  lon: number;
  lat: number;
  ele?: number | null;
  time?: number | null;
  name?: string;
  desc?: string;
}

export interface GpxData {
  name?: string;
  tracks: { name?: string; points: GpxPoint[] }[];
  routes: { name?: string; points: GpxPoint[] }[];
  waypoints: GpxPoint[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function pt(tag: string, p: GpxPoint, indent: string): string {
  const inner: string[] = [];
  if (p.ele != null) inner.push(`<ele>${p.ele.toFixed(1)}</ele>`);
  if (p.time != null) inner.push(`<time>${new Date(p.time).toISOString()}</time>`);
  if (p.name) inner.push(`<name>${esc(p.name)}</name>`);
  if (p.desc) inner.push(`<desc>${esc(p.desc)}</desc>`);
  const attrs = `lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"`;
  return inner.length ? `${indent}<${tag} ${attrs}>${inner.join("")}</${tag}>` : `${indent}<${tag} ${attrs}/>`;
}

export function buildGpx(opts: { name: string; track?: GpxPoint[]; route?: GpxPoint[]; waypoints?: GpxPoint[] }): string {
  const out = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="Moje Mapy" xmlns="http://www.topografix.com/GPX/1/1">`,
    `  <metadata><name>${esc(opts.name)}</name><time>${new Date().toISOString()}</time></metadata>`,
  ];
  for (const w of opts.waypoints ?? []) out.push(pt("wpt", w, "  "));
  if (opts.route?.length) {
    out.push(`  <rte><name>${esc(opts.name)}</name>`);
    for (const p of opts.route) out.push(pt("rtept", p, "    "));
    out.push("  </rte>");
  }
  if (opts.track?.length) {
    out.push(`  <trk><name>${esc(opts.name)}</name><trkseg>`);
    for (const p of opts.track) out.push(pt("trkpt", p, "    "));
    out.push("  </trkseg></trk>");
  }
  out.push("</gpx>");
  return out.join("\n");
}

const ARRAYS = new Set(["trk", "trkseg", "trkpt", "rte", "rtept", "wpt"]);
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  isArray: (name) => ARRAYS.has(name),
});

type XmlNode = Record<string, unknown>;
const text = (v: unknown): string | undefined =>
  v == null ? undefined : typeof v === "object" ? String((v as XmlNode)["#text"] ?? "") || undefined : String(v);

function toPoint(n: XmlNode): GpxPoint | null {
  const lat = Number(n["@_lat"]);
  const lon = Number(n["@_lon"]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const ele = Number(text(n.ele));
  const t = text(n.time);
  return {
    lat,
    lon,
    ele: Number.isFinite(ele) ? ele : null,
    time: t ? Date.parse(t) || null : null,
    name: text(n.name),
    desc: text(n.desc) ?? text(n.cmt),
  };
}

const points = (list: unknown): GpxPoint[] =>
  ((list as XmlNode[] | undefined) ?? []).map(toPoint).filter((p): p is GpxPoint => p != null);

export function parseGpx(xml: string): GpxData {
  const doc = parser.parse(xml) as XmlNode;
  const gpx = doc.gpx as XmlNode | undefined;
  if (!gpx) throw new Error("Not a GPX file");
  const meta = gpx.metadata as XmlNode | undefined;
  const tracks = ((gpx.trk as XmlNode[]) ?? []).map((trk) => ({
    name: text(trk.name),
    points: ((trk.trkseg as XmlNode[]) ?? []).flatMap((seg) => points(seg.trkpt)),
  }));
  const routes = ((gpx.rte as XmlNode[]) ?? []).map((rte) => ({ name: text(rte.name), points: points(rte.rtept) }));
  return {
    name: text(meta?.name) ?? tracks[0]?.name ?? routes[0]?.name,
    tracks: tracks.filter((t) => t.points.length > 1),
    routes: routes.filter((r) => r.points.length > 1),
    waypoints: points(gpx.wpt),
  };
}

export async function shareGpx(name: string, xml: string) {
  const safe = name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60) || "trasa";
  const file = new File(Paths.cache, `${safe}.gpx`);
  if (file.exists) file.delete();
  file.create();
  file.write(xml);
  await Sharing.shareAsync(file.uri, { mimeType: "application/gpx+xml", UTI: "com.topografix.gpx", dialogTitle: name });
}
