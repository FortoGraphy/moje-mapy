import type { LayerSpecification, SourceSpecification, StyleSpecification } from "@maplibre/maplibre-react-native";

import type { Lang } from "@/i18n";
import type { MapStyleId } from "@/store/settings";

import { PALETTES, type Palette } from "./palette";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Style JSON is validated with the official style-spec validator (scripts/validate-style.ts),
// so the literals are kept loosely typed instead of fighting the tuple-based expression types.
type Json = any;

export const FONT_REGULAR = ["Noto Sans Regular"];
export const FONT_BOLD = ["Noto Sans Bold"];
export const FONT_ITALIC = ["Noto Sans Italic"];

/** Overlays are inserted before these base layers. */
export const ANCHORS = {
  hillshade: "water",
  contours: "aeroway",
  tracks: "boundary-state",
  poi: "label-housenumber",
} as const;

export interface StyleSources {
  /** vector source url: TileJSON (OpenFreeMap) or pmtiles://file://... */
  base: string;
  /** outdoor overlay (pmtiles url) or null when unavailable */
  outdoor: string | null;
  /** raster-dem: pmtiles url or XYZ tiles */
  terrain: { url?: string; tiles?: string[]; maxzoom?: number };
}

export interface BuildStyleOptions {
  styleId: MapStyleId;
  sources: StyleSources;
  glyphs: string;
  lang: Lang;
  textScale: number;
  /** Hillshade must live in the style JSON: MapLibre RN crashes on iOS when hillshade paint is set as layer props. */
  hillshade?: boolean;
}

export function hillshadeSpec(p: Palette): Json {
  return {
    id: "ov-hillshade",
    type: "hillshade",
    source: "dem",
    paint: {
      "hillshade-exaggeration": p.hillshadeExaggeration,
      "hillshade-shadow-color": p.hillshadeShadow,
      "hillshade-highlight-color": p.hillshadeHighlight,
      "hillshade-accent-color": p.hillshadeAccent,
      "hillshade-illumination-direction": 315,
    },
  };
}

export const zi = (base: number, ...stops: number[]): Json => ["interpolate", ["exponential", base], ["zoom"], ...stops];

export function nameExpr(lang: Lang): Json {
  return ["coalesce", ["get", `name:${lang}`], ["get", "name"]];
}

const ROAD_ORDER = ["service", "minor", "tertiary", "secondary", "primary", "trunk", "motorway"] as const;
type RoadClass = (typeof ROAD_ORDER)[number];

const ROAD_WIDTH: Record<RoadClass, number[]> = {
  motorway: [5, 0.6, 9, 1.6, 12, 3.2, 15, 11, 18, 30],
  trunk: [5, 0.5, 9, 1.4, 12, 3, 15, 10, 18, 28],
  primary: [7, 0.5, 10, 1.4, 12, 2.6, 15, 9, 18, 26],
  secondary: [8, 0.4, 10, 1, 12, 2.2, 15, 8, 18, 22],
  tertiary: [9, 0.4, 11, 0.9, 13, 2, 15, 6.5, 18, 20],
  minor: [11, 0.4, 13, 1.2, 15, 4.5, 18, 16],
  service: [13, 0.4, 15, 2, 18, 9],
};

const ROAD_MINZOOM: Record<RoadClass, number> = {
  motorway: 4, trunk: 5, primary: 7, secondary: 8, tertiary: 9, minor: 11, service: 13,
};

function withOutline(stops: number[], extra: number): Json {
  const out: number[] = [];
  for (let i = 0; i < stops.length; i += 2) out.push(stops[i], stops[i + 1] + (stops[i] < 11 ? extra * 0.5 : extra));
  return zi(1.5, ...out);
}

function roadLayers(p: Palette, brunnel: "tunnel" | "road" | "bridge"): Json[] {
  const brunnelFilter =
    brunnel === "road"
      ? ["!", ["match", ["get", "brunnel"], ["tunnel", "bridge"], true, false]]
      : ["==", ["get", "brunnel"], brunnel];
  const cls = (list: string[]) => ["match", ["get", "class"], list, true, false];
  const tunnel = brunnel === "tunnel";
  const color: Record<RoadClass, string> = {
    motorway: p.motorway, trunk: p.trunk, primary: p.primary, secondary: p.secondary,
    tertiary: p.tertiary, minor: p.minor, service: p.service,
  };
  const out: Json[] = [];

  for (const c of ROAD_ORDER) {
    out.push({
      id: `${brunnel}-${c}-casing`,
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: Math.max(ROAD_MINZOOM[c], c === "service" || c === "minor" ? 12 : 6),
      filter: ["all", brunnelFilter, cls([c])],
      layout: { "line-cap": tunnel ? "butt" : "round", "line-join": "round" },
      paint: {
        "line-color": p.casing,
        "line-width": withOutline(ROAD_WIDTH[c], c === "service" || c === "minor" ? 1.2 : 1.8),
        ...(tunnel ? { "line-dasharray": [0.6, 0.4], "line-opacity": 0.6 } : {}),
      },
    });
  }
  out.push({
    id: `${brunnel}-track`,
    type: "line",
    source: "omt",
    "source-layer": "transportation",
    minzoom: 12,
    filter: ["all", brunnelFilter, cls(["track"])],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": p.track,
      "line-width": zi(1.4, 12, 0.8, 15, 2.2, 18, 5),
      "line-dasharray": [2.2, 1.2],
    },
  });
  out.push({
    id: `${brunnel}-path`,
    type: "line",
    source: "omt",
    "source-layer": "transportation",
    minzoom: 13,
    filter: ["all", brunnelFilter, cls(["path"])],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": p.path,
      "line-width": zi(1.4, 13, 0.6, 16, 1.4, 18, 2.6),
      "line-dasharray": [0.6, 1.4],
    },
  });
  for (const c of ROAD_ORDER) {
    out.push({
      id: `${brunnel}-${c}`,
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: ROAD_MINZOOM[c],
      filter: ["all", brunnelFilter, cls([c])],
      layout: { "line-cap": tunnel ? "butt" : "round", "line-join": "round" },
      paint: {
        "line-color": color[c],
        "line-width": zi(1.5, ...ROAD_WIDTH[c]),
        ...(tunnel ? { "line-opacity": 0.5 } : {}),
      },
    });
  }
  if (brunnel === "road") {
    out.push(
      {
        id: "rail",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 10,
        filter: ["all", brunnelFilter, cls(["rail", "transit"])],
        paint: { "line-color": p.rail, "line-width": zi(1.4, 10, 0.6, 16, 2, 18, 3) },
      },
      {
        id: "rail-hatch",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 14,
        filter: ["all", brunnelFilter, cls(["rail"])],
        paint: { "line-color": p.rail, "line-width": zi(1.4, 14, 3, 18, 7), "line-dasharray": [0.15, 2.5] },
      },
      {
        id: "ferry",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 9,
        filter: cls(["ferry"]),
        paint: { "line-color": p.waterway, "line-width": 1.2, "line-dasharray": [2, 2] },
      },
    );
  }
  return out;
}

export function buildStyle(o: BuildStyleOptions): StyleSpecification {
  const p = PALETTES[o.styleId];
  const ts = (n: number) => Math.round(n * o.textScale * 10) / 10;
  const name = nameExpr(o.lang);
  const halo = { "text-halo-color": p.halo, "text-halo-blur": 0.3 };

  const sources: Record<string, Json> = {
    omt: { type: "vector", url: o.sources.base, attribution: "© OpenStreetMap, OpenMapTiles, OpenFreeMap" },
    dem: {
      type: "raster-dem",
      encoding: "terrarium",
      tileSize: 256,
      ...(o.sources.terrain.url ? { url: o.sources.terrain.url } : { tiles: o.sources.terrain.tiles }),
      maxzoom: o.sources.terrain.maxzoom ?? 15,
      attribution: "Terrarium DEM (Mapzen, AWS Open Data)",
    },
  };
  if (o.sources.outdoor) {
    sources.outdoor = { type: "vector", url: o.sources.outdoor, attribution: "© OpenStreetMap" };
  }

  const layers: Json[] = [
    { id: "background", type: "background", paint: { "background-color": p.background } },
    {
      id: "landcover",
      type: "fill",
      source: "omt",
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match", ["get", "class"],
          "wood", p.wood,
          "grass", p.grass,
          "farmland", p.farmland,
          "wetland", p.wetland,
          ["sand", "rock"], p.sand,
          "ice", p.ice,
          p.grass,
        ],
        "fill-opacity": zi(1, 4, 0.6, 10, 1),
        "fill-antialias": false,
      },
    },
    {
      id: "landuse",
      type: "fill",
      source: "omt",
      "source-layer": "landuse",
      minzoom: 8,
      filter: ["match", ["get", "class"], ["residential", "suburb", "neighbourhood", "industrial", "commercial", "retail", "cemetery", "military", "quarry", "railway"], true, false],
      paint: {
        "fill-color": [
          "match", ["get", "class"],
          ["industrial", "commercial", "retail", "railway", "quarry", "military"], p.industrial,
          "cemetery", p.cemetery,
          p.residential,
        ],
        "fill-opacity": zi(1, 8, 0.4, 12, 0.9),
      },
    },
    {
      id: "park",
      type: "fill",
      source: "omt",
      "source-layer": "park",
      paint: { "fill-color": p.park, "fill-opacity": 0.55 },
    },
    {
      id: "water",
      type: "fill",
      source: "omt",
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": p.water },
    },
    {
      id: "waterway",
      type: "line",
      source: "omt",
      "source-layer": "waterway",
      minzoom: 8,
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      layout: { "line-cap": "round" },
      paint: {
        "line-color": p.waterway,
        "line-width": [
          "interpolate", ["exponential", 1.4], ["zoom"],
          8, ["match", ["get", "class"], "river", 0.8, 0.2],
          14, ["match", ["get", "class"], "river", 3, "canal", 2, 1],
          18, ["match", ["get", "class"], "river", 12, "canal", 8, 3],
        ],
      },
    },
    {
      id: "aeroway",
      type: "line",
      source: "omt",
      "source-layer": "aeroway",
      minzoom: 11,
      filter: ["match", ["get", "class"], ["runway", "taxiway"], true, false],
      paint: { "line-color": p.service, "line-width": zi(1.5, 11, 1, 16, 20) },
    },
    {
      id: "building",
      type: "fill",
      source: "omt",
      "source-layer": "building",
      minzoom: 13,
      paint: {
        "fill-color": p.building,
        "fill-outline-color": p.buildingOutline,
        "fill-opacity": zi(1, 13, 0, 14.5, 1),
      },
    },
    ...roadLayers(p, "tunnel"),
    ...roadLayers(p, "road"),
    ...roadLayers(p, "bridge"),
    {
      id: "boundary-state",
      type: "line",
      source: "omt",
      "source-layer": "boundary",
      minzoom: 5,
      filter: ["all", ["match", ["get", "admin_level"], [3, 4], true, false], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": p.boundary, "line-width": zi(1.3, 5, 0.5, 12, 1.5), "line-dasharray": [3, 2], "line-opacity": 0.6 },
    },
    {
      id: "boundary-country",
      type: "line",
      source: "omt",
      "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
      layout: { "line-join": "round" },
      paint: { "line-color": p.boundary, "line-width": zi(1.3, 3, 0.8, 10, 2.5, 16, 4), "line-opacity": 0.85 },
    },
    {
      id: "label-waterway",
      type: "symbol",
      source: "omt",
      "source-layer": "waterway",
      minzoom: 12,
      filter: ["has", "name"],
      layout: {
        "symbol-placement": "line",
        "text-field": name,
        "text-font": FONT_ITALIC,
        "text-size": ts(11),
        "text-letter-spacing": 0.05,
        "symbol-spacing": 400,
      },
      paint: { "text-color": p.waterText, ...halo, "text-halo-width": 1.4 },
    },
    {
      id: "label-water",
      type: "symbol",
      source: "omt",
      "source-layer": "water_name",
      filter: ["has", "name"],
      layout: { "text-field": name, "text-font": FONT_ITALIC, "text-size": ts(12), "text-max-width": 6 },
      paint: { "text-color": p.waterText, ...halo, "text-halo-width": 1.4 },
    },
    {
      id: "label-road",
      type: "symbol",
      source: "omt",
      "source-layer": "transportation_name",
      minzoom: 12,
      filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "track"], true, false],
      layout: {
        "symbol-placement": "line",
        "text-field": name,
        "text-font": FONT_REGULAR,
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, ts(10), 16, ts(13)],
        "text-rotation-alignment": "map",
        "text-pitch-alignment": "viewport",
        "symbol-spacing": 350,
      },
      paint: { "text-color": p.roadText, ...halo, "text-halo-width": 1.6 },
    },
    {
      id: "label-road-ref",
      type: "symbol",
      source: "omt",
      "source-layer": "transportation_name",
      minzoom: 8,
      filter: ["all", ["has", "ref"], ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false], ["<=", ["get", "ref_length"], 6]],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 500,
        "text-field": ["get", "ref"],
        "text-font": FONT_BOLD,
        "text-size": ts(10),
        "text-rotation-alignment": "viewport",
      },
      paint: {
        "text-color": p.dark ? "#0B0E13" : "#FFFFFF",
        "text-halo-color": ["match", ["get", "class"], "motorway", p.motorway, "trunk", p.trunk, p.primary],
        "text-halo-width": 3,
      },
    },
    {
      id: "label-peak",
      type: "symbol",
      source: "omt",
      "source-layer": "mountain_peak",
      minzoom: 10,
      filter: ["match", ["get", "class"], ["peak", "volcano"], true, false],
      layout: {
        "icon-image": ["match", ["get", "class"], "volcano", "poi-volcano", "poi-peak"],
        "icon-size": zi(1, 10, 0.7, 14, 1),
        "text-field": [
          "format",
          name, {},
          ["case", ["has", "ele"], ["concat", "\n", ["to-string", ["get", "ele"]], " m"], ""], { "font-scale": 0.85 },
        ],
        "text-font": FONT_ITALIC,
        "text-size": ts(11),
        "text-anchor": "top",
        "text-offset": [0, 0.7],
        "text-optional": true,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": p.peakText, ...halo, "text-halo-width": 1.4 },
    },
    {
      id: "label-housenumber",
      type: "symbol",
      source: "omt",
      "source-layer": "housenumber",
      minzoom: 17,
      layout: { "text-field": ["get", "housenumber"], "text-font": FONT_REGULAR, "text-size": ts(10) },
      paint: { "text-color": p.textDim, ...halo, "text-halo-width": 1 },
    },
    {
      id: "label-place-minor",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 11,
      filter: ["match", ["get", "class"], ["hamlet", "suburb", "neighbourhood", "quarter", "isolated_dwelling", "locality"], true, false],
      layout: {
        "text-field": name,
        "text-font": FONT_REGULAR,
        "text-size": ["match", ["get", "class"], "suburb", ts(12), ts(11)],
        "text-max-width": 8,
        "text-transform": ["match", ["get", "class"], ["suburb", "quarter"], "uppercase", "none"],
        "text-letter-spacing": ["match", ["get", "class"], ["suburb", "quarter"], 0.08, 0],
      },
      paint: { "text-color": p.textDim, ...halo, "text-halo-width": 1.4 },
    },
    {
      id: "label-village",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 9,
      filter: ["==", ["get", "class"], "village"],
      layout: {
        "text-field": name,
        "text-font": FONT_REGULAR,
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, ts(10), 14, ts(14)],
        "text-max-width": 8,
      },
      paint: { "text-color": p.text, ...halo, "text-halo-width": 1.5 },
    },
    {
      id: "label-town",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 6,
      filter: ["==", ["get", "class"], "town"],
      layout: {
        "text-field": name,
        "text-font": FONT_BOLD,
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, ts(10), 14, ts(17)],
        "text-max-width": 8,
      },
      paint: { "text-color": p.text, ...halo, "text-halo-width": 1.6 },
    },
    {
      id: "label-city",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 4,
      maxzoom: 15,
      filter: ["==", ["get", "class"], "city"],
      layout: {
        "text-field": name,
        "text-font": FONT_BOLD,
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, ts(11), 8, ts(15), 12, ts(20)],
        "text-max-width": 8,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": p.text, ...halo, "text-halo-width": 1.8 },
    },
    {
      id: "label-country",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      maxzoom: 8,
      filter: ["==", ["get", "class"], "country"],
      layout: {
        "text-field": name,
        "text-font": FONT_BOLD,
        "text-size": ["interpolate", ["linear"], ["zoom"], 2, ts(11), 6, ts(16)],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.1,
        "text-max-width": 6,
      },
      paint: { "text-color": p.textDim, ...halo, "text-halo-width": 1.6 },
    },
  ];

  if (o.hillshade) {
    const at = layers.findIndex((l) => l.id === ANCHORS.hillshade);
    layers.splice(at < 0 ? 1 : at, 0, hillshadeSpec(p));
  }

  return {
    version: 8,
    name: `moje-mapy-${o.styleId}`,
    glyphs: o.glyphs,
    sources: sources as Record<string, SourceSpecification>,
    layers: layers as LayerSpecification[],
  };
}
