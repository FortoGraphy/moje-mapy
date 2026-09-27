import type { Lang } from "@/i18n";
import { POI_CATEGORIES, POI_CATEGORY_COLORS, POI_CLASS_TO_CATEGORY, type PoiCategory } from "@/map/poiCategories";
import { POI_ICON_CLASSES } from "@/map/icons.generated";

import { ANCHORS, FONT_ITALIC, FONT_REGULAR, nameExpr, zi } from "./buildStyle";
import { TRACK_COLORS as C, type Palette } from "./palette";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type OverlayLayer = Record<string, any> & { id: string; type: string };

const TRACK_COLOR = [
  "case",
  ["has", "tracktype"],
  ["match", ["get", "tracktype"], "grade1", C.grade1, "grade2", C.grade2, "grade3", C.grade3, "grade4", C.grade4, "grade5", C.grade5, C.unknown],
  ["has", "surface"],
  [
    "match", ["get", "surface"],
    ["asphalt", "paved", "concrete", "concrete:plates", "paving_stones", "sett", "metal"], C.grade1,
    ["compacted", "fine_gravel", "gravel", "pebblestone"], C.grade2,
    ["unpaved", "rock", "stones", "grass_paver"], C.grade3,
    ["ground", "dirt", "earth", "grass", "sand", "woodchips"], C.grade4,
    ["mud", "clay", "ice", "snow"], C.grade5,
    C.unknown,
  ],
  C.unknown,
];

const IS_TRACK = ["==", ["get", "highway"], "track"];
const HAS_GRADE = ["any", ["has", "tracktype"], ["has", "surface"]];

const ALLOWED = [
  "any",
  ["match", ["get", "motorcycle"], ["yes", "permissive", "designated"], true, false],
  ["match", ["get", "motor_vehicle"], ["yes", "permissive", "designated"], true, false],
];

/** Ways closed to motorcycles (explicit tags, or implicit for footway/cycleway/bridleway). */
export const RESTRICTED = [
  "all",
  ["!", ALLOWED],
  [
    "any",
    ["match", ["get", "access"], ["no", "private", "forestry", "agricultural", "delivery"], true, false],
    ["match", ["get", "motor_vehicle"], ["no", "private", "forestry", "agricultural", "delivery", "agricultural;forestry"], true, false],
    ["match", ["get", "motorcycle"], ["no", "private"], true, false],
    ["match", ["get", "vehicle"], ["no", "private", "forestry", "agricultural"], true, false],
    ["match", ["get", "highway"], ["footway", "cycleway", "bridleway"], true, false],
  ],
];

export function trackLayers(p: Palette): OverlayLayer[] {
  const before = ANCHORS.tracks;
  return [
    {
      id: "ov-tracks-casing",
      type: "line",
      source: "outdoor",
      "source-layer": "tracks",
      minzoom: 11,
      filter: IS_TRACK,
      beforeId: before,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": p.trackCasing,
        "line-opacity": p.dark ? 0.85 : 0.9,
        "line-width": zi(1.4, 11, 2.4, 14, 4.6, 17, 8.5),
      },
    },
    {
      id: "ov-tracks",
      type: "line",
      source: "outdoor",
      "source-layer": "tracks",
      minzoom: 11,
      filter: ["all", IS_TRACK, HAS_GRADE],
      beforeId: before,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": TRACK_COLOR,
        "line-width": zi(1.4, 11, 1.2, 14, 2.6, 17, 5.5),
      },
    },
    {
      id: "ov-tracks-unknown",
      type: "line",
      source: "outdoor",
      "source-layer": "tracks",
      minzoom: 11,
      filter: ["all", IS_TRACK, ["!", HAS_GRADE]],
      beforeId: before,
      layout: { "line-join": "round" },
      paint: {
        "line-color": C.unknown,
        "line-width": zi(1.4, 11, 1.2, 14, 2.6, 17, 5.5),
        "line-dasharray": [2, 1.2],
      },
    },
    {
      id: "ov-paths",
      type: "line",
      source: "outdoor",
      "source-layer": "tracks",
      minzoom: 13,
      filter: ["!", IS_TRACK],
      beforeId: before,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": p.dark ? C.path : "#8A5A3C",
        "line-width": zi(1.4, 13, 1, 16, 2, 18, 3.2),
        "line-dasharray": [0.4, 1.6],
        "line-opacity": 0.9,
      },
    },
  ];
}

/** Used when no outdoor archive is available: OpenMapTiles only knows paved/unpaved and access=no. */
export function trackFallbackLayers(p: Palette): OverlayLayer[] {
  const before = ANCHORS.tracks;
  const isTrack = ["==", ["get", "class"], "track"];
  return [
    {
      id: "ov-fb-tracks-casing",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 11,
      filter: isTrack,
      beforeId: before,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": p.trackCasing, "line-opacity": 0.85, "line-width": zi(1.4, 11, 2.4, 14, 4.6, 17, 8.5) },
    },
    {
      id: "ov-fb-tracks",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 11,
      filter: isTrack,
      beforeId: before,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["match", ["get", "surface"], "paved", C.grade1, "unpaved", C.grade3, C.unknown],
        "line-width": zi(1.4, 11, 1.2, 14, 2.6, 17, 5.5),
      },
    },
    {
      id: "ov-fb-paths",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 13,
      filter: ["==", ["get", "class"], "path"],
      beforeId: before,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": p.dark ? C.path : "#8A5A3C",
        "line-width": zi(1.4, 13, 1, 16, 2, 18, 3.2),
        "line-dasharray": [0.4, 1.6],
      },
    },
  ];
}

export function accessFallbackLayer(): OverlayLayer {
  return {
    id: "ov-fb-access",
    type: "line",
    source: "omt",
    "source-layer": "transportation",
    minzoom: 12,
    filter: ["==", ["get", "access"], "no"],
    beforeId: ANCHORS.tracks,
    paint: {
      "line-color": C.restricted,
      "line-width": zi(1.4, 12, 1, 14, 2, 17, 3.5),
      "line-dasharray": [1, 1.6],
    },
  };
}

/** Invisible, queryable layer for the speed limit lookup. */
export const MAXSPEED_QUERY_LAYER = "q-maxspeed";
export function maxspeedQueryLayer(): OverlayLayer {
  return {
    id: MAXSPEED_QUERY_LAYER,
    type: "line",
    source: "outdoor",
    "source-layer": "roads",
    minzoom: 13,
    paint: { "line-opacity": 0, "line-width": 14 },
  };
}

export function accessLayers(): OverlayLayer[] {
  const paint = {
    "line-color": C.restricted,
    "line-width": zi(1.4, 11, 1, 14, 2, 17, 3.5),
    "line-dasharray": [1, 1.6],
    "line-opacity": 0.95,
  };
  return [
    {
      id: "ov-access-tracks",
      type: "line",
      source: "outdoor",
      "source-layer": "tracks",
      minzoom: 12,
      filter: RESTRICTED,
      beforeId: ANCHORS.tracks,
      paint,
    },
    {
      id: "ov-access-roads",
      type: "line",
      source: "outdoor",
      "source-layer": "access",
      minzoom: 12,
      filter: ["!", ALLOWED],
      beforeId: ANCHORS.tracks,
      paint,
    },
  ];
}

export function contourLayers(p: Palette, textScale: number): OverlayLayer[] {
  return [
    {
      id: "ov-contours",
      type: "line",
      source: "outdoor",
      "source-layer": "contours",
      minzoom: 11,
      beforeId: ANCHORS.contours,
      paint: {
        "line-color": p.contour,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.35, 14, 0.55],
        "line-width": ["match", ["get", "idx"], 100, 1.1, 50, 0.8, 0.45],
      },
    },
    {
      id: "ov-contours-label",
      type: "symbol",
      source: "outdoor",
      "source-layer": "contours",
      minzoom: 13,
      filter: ["match", ["get", "idx"], [50, 100], true, false],
      beforeId: ANCHORS.contours,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 320,
        "text-field": ["concat", ["to-string", ["get", "ele"]], " m"],
        "text-font": FONT_ITALIC,
        "text-size": 9.5 * textScale,
        "text-padding": 10,
      },
      paint: { "text-color": p.contourText, "text-halo-color": p.halo, "text-halo-width": 1.2 },
    },
  ];
}

export function hillshadeLayer(p: Palette): OverlayLayer {
  return {
    id: "ov-hillshade",
    type: "hillshade",
    source: "dem",
    beforeId: ANCHORS.hillshade,
    paint: {
      "hillshade-exaggeration": p.hillshadeExaggeration,
      "hillshade-shadow-color": p.hillshadeShadow,
      "hillshade-highlight-color": p.hillshadeHighlight,
      "hillshade-accent-color": p.hillshadeAccent,
      "hillshade-illumination-direction": 315,
    },
  };
}

export function buildings3dLayer(p: Palette): OverlayLayer {
  return {
    id: "ov-buildings-3d",
    type: "fill-extrusion",
    source: "omt",
    "source-layer": "building",
    minzoom: 14.5,
    filter: ["!=", ["get", "hide_3d"], true],
    beforeId: ANCHORS.tracks,
    paint: {
      "fill-extrusion-color": p.building,
      "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": 0.85,
    },
  };
}

const ALL_KNOWN = Object.keys(POI_CLASS_TO_CATEGORY);

function categoryColorExpr(): unknown[] {
  const expr: unknown[] = ["match", ["get", "class"]];
  for (const cat of POI_CATEGORIES) {
    const classes = ALL_KNOWN.filter((c) => POI_CLASS_TO_CATEGORY[c] === cat);
    if (classes.length) expr.push(classes, POI_CATEGORY_COLORS[cat]);
  }
  expr.push(POI_CATEGORY_COLORS.services);
  return expr;
}

export function poiLayers(
  p: Palette,
  enabled: Record<PoiCategory, boolean>,
  lang: Lang,
  textScale: number,
): OverlayLayer[] {
  const enabledClasses = ALL_KNOWN.filter((c) => enabled[POI_CLASS_TO_CATEGORY[c]]);
  const classFilter: unknown[] = [
    "any",
    enabledClasses.length ? ["match", ["get", "class"], enabledClasses, true, false] : false,
    enabled.services ? ["!", ["match", ["get", "class"], ALL_KNOWN, true, false]] : false,
  ];
  const icon = ["match", ["get", "class"], POI_ICON_CLASSES, ["concat", "poi-", ["get", "class"]], "poi-default"];
  const textColor = p.dark ? "#C9D2DD" : categoryColorExpr();
  const base = {
    type: "symbol",
    source: "omt",
    "source-layer": "poi",
    beforeId: ANCHORS.poi,
    layout: {
      "icon-image": icon,
      "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.72, 16, 0.95],
      "icon-padding": 2,
      "text-field": nameExpr(lang),
      "text-font": FONT_REGULAR,
      "text-size": 11 * textScale,
      "text-anchor": "top",
      "text-offset": [0, 1.05],
      "text-max-width": 8,
      "text-optional": true,
      "symbol-sort-key": ["get", "rank"],
    },
    paint: {
      "text-color": textColor,
      "text-halo-color": p.halo,
      "text-halo-width": 1.4,
    },
  };
  const fuelOn = enabled.fuel;
  const motoOn = enabled.moto;
  const layers: OverlayLayer[] = [];
  if (fuelOn || motoOn) {
    layers.push({
      ...base,
      id: "ov-poi-priority",
      minzoom: 11.5,
      maxzoom: 14,
      filter: ["match", ["get", "class"], [...(fuelOn ? ["fuel"] : []), ...(motoOn ? ["motorcycle"] : [])], true, false],
    });
  }
  layers.push({
    ...base,
    id: "ov-poi-major",
    minzoom: 14,
    maxzoom: 16,
    filter: ["all", classFilter, ["<=", ["get", "rank"], 18]],
  });
  layers.push({ ...base, id: "ov-poi-all", minzoom: 16, filter: classFilter });
  return layers;
}
