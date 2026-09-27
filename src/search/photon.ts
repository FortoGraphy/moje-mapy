import { CONFIG } from "@/config";
import { currentLang } from "@/i18n";
import type { Place } from "@/types";

interface PhotonProps {
  osm_id: number;
  osm_type: "N" | "W" | "R";
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  district?: string;
  locality?: string;
  county?: string;
  state?: string;
  country?: string;
}

type PhotonFeature = GeoJSON.Feature<GeoJSON.Point, PhotonProps>;

/** Photon has no Czech locale; "default" returns the local (Czech) names. */
const photonLang = () => (currentLang() === "en" ? "en" : "default");

function toPlace(f: PhotonFeature): Place {
  const p = f.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const name = p.name ?? (street || p.city || p.county || "?");
  const town = p.city ?? p.locality ?? p.district;
  const parts = [
    p.name && street ? street : null,
    town && town !== name ? town : null,
    p.type === "city" || p.type === "district" ? p.county ?? p.state : null,
    p.country && p.country !== "Česko" && p.country !== "Czechia" ? p.country : null,
  ].filter(Boolean);
  const [lon, lat] = f.geometry.coordinates;
  return {
    id: `${p.osm_type}${p.osm_id}`,
    name,
    subtitle: parts.join(", ") || undefined,
    lon,
    lat,
    category: p.osm_value ?? p.type,
    osmType: p.osm_type,
    osmId: p.osm_id,
  };
}

async function get(url: string, signal?: AbortSignal): Promise<PhotonFeature[]> {
  const res = await fetch(url, { headers: { "User-Agent": CONFIG.userAgent }, signal });
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
  const json = (await res.json()) as GeoJSON.FeatureCollection<GeoJSON.Point, PhotonProps>;
  return json.features;
}

export async function photonSearch(
  q: string,
  near: [number, number] | null,
  opts: { limit?: number; signal?: AbortSignal } = {},
): Promise<Place[]> {
  const params = new URLSearchParams({ q, limit: String(opts.limit ?? 15), lang: photonLang() });
  if (near) {
    params.set("lon", near[0].toFixed(5));
    params.set("lat", near[1].toFixed(5));
    params.set("location_bias_scale", "0.3");
  }
  const feats = await get(`${CONFIG.photonUrl}?${params}`, opts.signal);
  const seen = new Set<string>();
  return feats.map(toPlace).filter((p) => {
    const key = `${p.name}|${p.subtitle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function photonReverse(lon: number, lat: number, signal?: AbortSignal): Promise<Place | null> {
  const params = new URLSearchParams({ lon: String(lon), lat: String(lat), lang: photonLang(), limit: "1" });
  const feats = await get(`${CONFIG.photonReverseUrl}?${params}`, signal);
  return feats[0] ? toPlace(feats[0]) : null;
}
