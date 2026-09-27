/**
 * Central endpoints. Everything is free and key-less.
 * EXPO_PUBLIC_DATA_BASE_URL points to the public Cloudflare R2 bucket filled by the data pipeline,
 * e.g. https://pub-xxxxxxxx.r2.dev (no trailing slash).
 */
export const CONFIG = {
  openFreeMapTileJson: "https://tiles.openfreemap.org/planet",
  terrariumTiles: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
  dataBaseUrl: (process.env.EXPO_PUBLIC_DATA_BASE_URL ?? "").replace(/\/$/, ""),
  brouterUrl: "https://brouter.de/brouter",
  photonUrl: "https://photon.komoot.io/api",
  photonReverseUrl: "https://photon.komoot.io/reverse",
  overpassUrl: "https://overpass-api.de/api/interpreter",
  userAgent: "MojeMapy/1.0 (iOS; enduro navigation)",
} as const;

export const DEFAULT_CENTER: [number, number] = [15.47, 49.8];
export const DEFAULT_ZOOM = 6.5;

export function dataUrl(path: string): string | null {
  return CONFIG.dataBaseUrl ? `${CONFIG.dataBaseUrl}/${path.replace(/^\//, "")}` : null;
}
