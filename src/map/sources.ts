import { CONFIG, dataUrl } from "@/config";
import type { DownloadedRegion } from "@/db/regions";
import type { Catalog } from "@/offline/catalog";
import { localUri } from "@/offline/catalog";
import { inBbox } from "@/utils/geo";

import type { StyleSources } from "./style/buildStyle";

const KIND_PRIORITY = { country: 0, region: 1, district: 2 } as const;

/** Picks the downloaded region covering a point; bigger regions win so panning switches styles less often. */
export function regionAt(regions: DownloadedRegion[], lonLat: [number, number]): DownloadedRegion | null {
  let best: DownloadedRegion | null = null;
  for (const r of regions) {
    if (!r.files.map || !inBbox(lonLat, r.bbox)) continue;
    if (!best || KIND_PRIORITY[r.kind] < KIND_PRIORITY[best.kind]) best = r;
  }
  return best;
}

export interface ResolvedSources {
  sources: StyleSources;
  /** region whose local files are used for the base map, null = online */
  region: DownloadedRegion | null;
}

export function resolveSources(opts: {
  region: DownloadedRegion | null;
  online: boolean;
  preferOffline: boolean;
  catalog: Catalog | null;
}): ResolvedSources {
  const { region, online, preferOffline, catalog } = opts;
  const remoteOutdoorPath = catalog?.online.outdoor;
  const remoteOutdoorUrl = remoteOutdoorPath ? dataUrl(remoteOutdoorPath) : null;
  const remoteOutdoor = remoteOutdoorUrl ? `pmtiles://${remoteOutdoorUrl}` : null;
  const onlineTerrain = { tiles: [CONFIG.terrariumTiles], maxzoom: 15 };

  const useLocal = region != null && (!online || preferOffline);
  if (useLocal && region) {
    const f = region.files;
    return {
      region,
      sources: {
        base: `pmtiles://${localUri(f.map!)}`,
        outdoor: f.outdoor ? `pmtiles://${localUri(f.outdoor)}` : online ? remoteOutdoor : null,
        terrain: f.terrain ? { url: `pmtiles://${localUri(f.terrain)}` } : onlineTerrain,
      },
    };
  }
  return {
    region: null,
    sources: {
      base: CONFIG.openFreeMapTileJson,
      outdoor: remoteOutdoor,
      terrain: onlineTerrain,
    },
  };
}
