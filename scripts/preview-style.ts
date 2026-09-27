// Dumps style JSON for a browser preview (scripts/preview/index.html). Run: npm run preview:style
import fs from "node:fs";
import path from "node:path";

import { POI_CATEGORIES } from "../src/map/poiCategories";
import { buildStyle } from "../src/map/style/buildStyle";
import { buildings3dLayer, hillshadeLayer, poiLayers } from "../src/map/style/overlays";
import { PALETTES } from "../src/map/style/palette";

const out = path.join(__dirname, "preview");
fs.mkdirSync(out, { recursive: true });
for (const styleId of ["enduro", "road", "topo"] as const) {
  const style = buildStyle({
    styleId,
    lang: "cs",
    textScale: 1,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      base: "https://tiles.openfreemap.org/planet",
      outdoor: null,
      terrain: { tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], maxzoom: 15 },
    },
  });
  const p = PALETTES[styleId];
  const enabled = Object.fromEntries(POI_CATEGORIES.map((c) => [c, true])) as never;
  const overlays = [hillshadeLayer(p), buildings3dLayer(p), ...poiLayers(p, enabled, "cs", 1)];
  for (const { beforeId, ...layer } of overlays) {
    const i = style.layers.findIndex((l) => l.id === beforeId);
    style.layers.splice(i < 0 ? style.layers.length : i, 0, layer as never);
  }
  fs.writeFileSync(path.join(out, `${styleId}.json`), JSON.stringify(style));
}
console.log("written to", out);
