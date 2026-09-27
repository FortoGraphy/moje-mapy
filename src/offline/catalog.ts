import { File, Paths } from "expo-file-system";

import { CONFIG, dataUrl } from "@/config";
import type { RegionFiles, RegionKind } from "@/db/regions";

export type RegionFileKey = keyof RegionFiles;

export interface CatalogRegion {
  id: string;
  kind: RegionKind;
  parent: string | null;
  name: { cs: string; en: string };
  bbox: [number, number, number, number];
  center: [number, number];
  files: Partial<Record<RegionFileKey, { path: string; size: number }>>;
  size: number;
  version: string;
}

export interface Catalog {
  version: string;
  generated: string;
  online: { outdoor?: string };
  regions: CatalogRegion[];
}

const cacheFile = () => new File(Paths.document, "catalog.json");

export function cachedCatalog(): Catalog | null {
  try {
    const f = cacheFile();
    return f.exists ? (JSON.parse(f.textSync()) as Catalog) : null;
  } catch {
    return null;
  }
}

export async function fetchCatalog(): Promise<Catalog | null> {
  const url = dataUrl("catalog.json");
  if (!url) return null;
  const res = await fetch(`${url}?t=${Date.now()}`, { headers: { "User-Agent": CONFIG.userAgent } });
  if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
  const text = await res.text();
  const catalog = JSON.parse(text) as Catalog;
  cacheFile().write(text);
  return catalog;
}

export function localUri(relPath: string): string {
  return new File(Paths.document, relPath).uri;
}
