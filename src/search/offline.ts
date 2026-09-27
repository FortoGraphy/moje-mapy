import { File, Paths } from "expo-file-system";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import type { DownloadedRegion } from "@/db/regions";
import type { Place } from "@/types";
import { haversine } from "@/utils/geo";

interface Row {
  name: string;
  alt: string;
  city: string;
  kind: string;
  cls: string;
  lon: number;
  lat: number;
  prio: number;
  rank: number;
}

const open = new Map<string, SQLiteDatabase>();

function dbFor(region: DownloadedRegion): SQLiteDatabase | null {
  const rel = region.files.search;
  if (!rel) return null;
  const cached = open.get(rel);
  if (cached) return cached;
  const file = new File(Paths.document, rel);
  if (!file.exists) return null;
  const dir = decodeURIComponent(file.parentDirectory.uri.replace(/^file:\/\//, "")).replace(/\/$/, "");
  const db = openDatabaseSync(file.name, {}, dir);
  open.set(rel, db);
  return db;
}

export function closeOfflineSearch(rel?: string) {
  for (const [key, db] of open) {
    if (rel && key !== rel) continue;
    db.closeSync();
    open.delete(key);
  }
}

function ftsQuery(q: string): string | null {
  const tokens = q
    .toLowerCase()
    .replace(/["'*^():]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 6);
  if (!tokens.length) return null;
  return tokens.map((w) => `"${w}"*`).join(" ");
}

/**
 * Full-text search over all downloaded regions (country archives contain their regions,
 * so duplicates from overlapping downloads are merged).
 */
export function offlineSearch(q: string, regions: DownloadedRegion[], near: [number, number] | null, limit = 20): Place[] {
  const match = ftsQuery(q);
  if (!match) return [];
  const rows: Row[] = [];
  const seenFiles = new Set<string>();
  for (const r of regions) {
    if (!r.files.search || seenFiles.has(r.files.search)) continue;
    seenFiles.add(r.files.search);
    try {
      const db = dbFor(r);
      if (!db) continue;
      rows.push(
        ...db.getAllSync<Row>(
          `SELECT name, alt, city, kind, cls, lon, lat, prio, bm25(search, 10.0, 4.0, 1.0) AS rank
           FROM search WHERE search MATCH ? ORDER BY rank LIMIT 80`,
          match,
        ),
      );
    } catch (e) {
      console.warn("offline search", r.id, e);
    }
  }
  const scored = rows.map((row) => {
    const dist = near ? haversine(near, [row.lon, row.lat]) : 0;
    // bm25 is negative (lower = better); add importance and a gentle distance penalty.
    const score = row.rank - row.prio / 25 + Math.log10(1 + dist / 1000) * 0.8;
    return { row, score };
  });
  scored.sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const { row } of scored) {
    const key = `${row.name}|${row.lon.toFixed(3)}|${row.lat.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `off-${key}`,
      name: row.name,
      subtitle: row.city || undefined,
      lon: row.lon,
      lat: row.lat,
      category: row.cls || row.kind,
    });
    if (out.length >= limit) break;
  }
  return out;
}
