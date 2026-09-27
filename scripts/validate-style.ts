// Validates every generated map style (+ all overlays) with the official MapLibre style-spec validator.
// Run: npm run validate:style
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";

import { POI_CATEGORIES } from "../src/map/poiCategories";
import { buildStyle } from "../src/map/style/buildStyle";
import {
  accessFallbackLayer,
  accessLayers,
  buildings3dLayer,
  maxspeedQueryLayer,
  trackFallbackLayers,
  contourLayers,
  hillshadeLayer,
  poiLayers,
  trackLayers,
} from "../src/map/style/overlays";
import { PALETTES } from "../src/map/style/palette";
import { MAP_ICONS } from "../src/map/icons.generated";

let failed = 0;
for (const styleId of ["enduro", "road", "topo"] as const) {
  for (const lang of ["cs", "en"] as const) {
    const style = buildStyle({
      styleId,
      lang,
      textScale: 1.2,
      glyphs: "file:///glyphs/{fontstack}/{range}.pbf",
      sources: {
        base: "https://tiles.openfreemap.org/planet",
        outdoor: "pmtiles://https://example.com/outdoor.pmtiles",
        terrain: { tiles: ["https://example.com/{z}/{x}/{y}.png"], maxzoom: 15 },
      },
    });
    const p = PALETTES[styleId];
    const enabled = Object.fromEntries(POI_CATEGORIES.map((c, i) => [c, i % 3 !== 0])) as never;
    const overlays = [
      hillshadeLayer(p),
      ...contourLayers(p, 1),
      ...trackLayers(p),
      ...accessLayers(),
      ...trackFallbackLayers(p),
      accessFallbackLayer(),
      maxspeedQueryLayer(),
      buildings3dLayer(p),
      ...poiLayers(p, enabled, lang, 1),
    ];
    const ids = new Set(style.layers.map((l) => l.id));
    for (const o of overlays) {
      const { beforeId, ...layer } = o;
      if (beforeId && !ids.has(beforeId)) {
        console.error(`[${styleId}] ${o.id}: beforeId "${beforeId}" not in base style`);
        failed++;
      }
      style.layers.push(layer as never);
    }
    const errors = validateStyleMin(style);
    for (const e of errors) console.error(`[${styleId}/${lang}] ${e.message}`);
    failed += errors.length;
    console.log(`${styleId}/${lang}: ${style.layers.length} layers, ${errors.length} errors`);
  }
}

const icons = new Set(Object.keys(MAP_ICONS));
for (const needed of ["poi-default", "poi-peak", "poi-volcano"]) {
  if (!icons.has(needed)) {
    console.error(`missing icon ${needed}`);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed} problem(s)`);
  process.exit(1);
}
console.log("OK");
