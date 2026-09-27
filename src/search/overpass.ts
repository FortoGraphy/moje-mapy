import { CONFIG } from "@/config";
import { currentLang } from "@/i18n";
import type { Place } from "@/types";
import { haversine } from "@/utils/geo";

export const NEARBY_CATEGORIES = {
  fuel: { query: 'nwr["amenity"="fuel"]', cls: "fuel" },
  food: { query: 'nwr["amenity"~"^(restaurant|fast_food|cafe|pub|bar)$"]', cls: "restaurant" },
  shop: { query: 'nwr["shop"~"^(supermarket|convenience|general)$"]', cls: "grocery" },
  lodging: { query: 'nwr["tourism"~"^(hotel|guest_house|hostel|camp_site|chalet|motel)$"]', cls: "lodging" },
  moto: { query: 'nwr["shop"~"^(motorcycle|motorcycle_repair|car_repair)$"]', cls: "motorcycle" },
  viewpoint: { query: 'nwr["tourism"="viewpoint"]', cls: "viewpoint" },
  water: { query: 'nwr["amenity"="drinking_water"]', cls: "drinking_water" },
  parking: { query: 'nwr["amenity"~"^(motorcycle_parking|parking)$"]', cls: "parking" },
} as const;

export type NearbyCategory = keyof typeof NEARBY_CATEGORIES;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function overpass(query: string, signal?: AbortSignal): Promise<OverpassElement[]> {
  const res = await fetch(CONFIG.overpassUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": CONFIG.userAgent },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return ((await res.json()) as { elements: OverpassElement[] }).elements;
}

export async function searchNearby(
  cat: NearbyCategory,
  near: [number, number],
  radius = 10000,
  signal?: AbortSignal,
): Promise<Place[]> {
  const { query, cls } = NEARBY_CATEGORIES[cat];
  const els = await overpass(
    `[out:json][timeout:15];${query}(around:${radius},${near[1]},${near[0]});out center tags 60;`,
    signal,
  );
  const lang = currentLang();
  return els
    .map((e): Place | null => {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (lat == null || lon == null) return null;
      const tags = e.tags ?? {};
      const name = tags[`name:${lang}`] ?? tags.name ?? tags.brand ?? tags.operator;
      if (!name) return null;
      const addr = [tags["addr:street"] ?? tags["addr:place"], tags["addr:housenumber"]].filter(Boolean).join(" ");
      return {
        id: `${e.type[0].toUpperCase()}${e.id}`,
        name,
        subtitle: [addr, tags["addr:city"]].filter(Boolean).join(", ") || undefined,
        lon,
        lat,
        category: tags.amenity ?? tags.shop ?? tags.tourism ?? cls,
        osmType: e.type[0].toUpperCase() as Place["osmType"],
        osmId: e.id,
        tags,
      };
    })
    .filter((p): p is Place => p != null)
    .sort((a, b) => haversine(near, [a.lon, a.lat]) - haversine(near, [b.lon, b.lat]));
}

export async function fetchOsmTags(
  osmType: "N" | "W" | "R",
  osmId: number,
  signal?: AbortSignal,
): Promise<Record<string, string> | null> {
  const kind = osmType === "N" ? "node" : osmType === "W" ? "way" : "relation";
  const els = await overpass(`[out:json][timeout:10];${kind}(${osmId});out tags;`, signal);
  return els[0]?.tags ?? null;
}
