import { db } from "./index";

export type RegionKind = "country" | "region" | "district";

export interface RegionFiles {
  map?: string;
  outdoor?: string;
  terrain?: string;
  search?: string;
}

export interface DownloadedRegion {
  id: string;
  name: string;
  kind: RegionKind;
  version: string;
  size: number;
  bbox: [number, number, number, number];
  /** paths relative to the Documents directory (the app container path changes between installs) */
  files: RegionFiles;
  downloaded_at: number;
}

interface Row extends Omit<DownloadedRegion, "bbox" | "files"> {
  bbox: string;
  files: string;
}

export function listDownloadedRegions(): DownloadedRegion[] {
  return db
    .getAllSync<Row>("SELECT * FROM regions ORDER BY kind, name")
    .map((r) => ({ ...r, bbox: JSON.parse(r.bbox), files: JSON.parse(r.files) }));
}

export function upsertRegion(r: DownloadedRegion) {
  db.runSync(
    "INSERT OR REPLACE INTO regions (id, name, kind, version, size, bbox, files, downloaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    r.id, r.name, r.kind, r.version, r.size, JSON.stringify(r.bbox), JSON.stringify(r.files), r.downloaded_at,
  );
}

export function removeRegion(id: string) {
  db.runSync("DELETE FROM regions WHERE id = ?", id);
}
