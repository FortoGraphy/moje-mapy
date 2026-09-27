// GPX build/parse round trip. Run: node --require ./scripts/node-stubs.cjs --import tsx scripts/test-gpx.ts
import assert from "node:assert/strict";

import { buildGpx, parseGpx } from "../src/utils/gpx";

const xml = buildGpx({
  name: "Okruh <Žďár> & zpět",
  track: [
    { lon: 16.1, lat: 49.5, ele: 500.25, time: Date.UTC(2026, 8, 1, 8, 0, 0) },
    { lon: 16.2, lat: 49.6, ele: 510, time: Date.UTC(2026, 8, 1, 8, 0, 5) },
  ],
  waypoints: [{ lon: 16.15, lat: 49.55, name: "Brod" }],
});
const g = parseGpx(xml);
assert.equal(g.name, "Okruh <Žďár> & zpět");
assert.equal(g.tracks[0].points.length, 2);
assert.equal(g.tracks[0].points[0].ele, 500.3);
assert.equal(g.tracks[0].points[1].time, Date.UTC(2026, 8, 1, 8, 0, 5));
assert.equal(g.waypoints[0].name, "Brod");

// Foreign file: GPX 1.0 namespace prefix, several segments, route only, CDATA name.
const foreign = `<?xml version="1.0"?>
<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/0" version="1.0">
  <gpx:trk><gpx:name><![CDATA[Lesní okruh]]></gpx:name>
    <gpx:trkseg><gpx:trkpt lat="49.1" lon="16.1"/><gpx:trkpt lat="49.2" lon="16.2"><gpx:ele>300</gpx:ele></gpx:trkpt></gpx:trkseg>
    <gpx:trkseg><gpx:trkpt lat="49.3" lon="16.3"/></gpx:trkseg>
  </gpx:trk>
  <gpx:rte><gpx:rtept lat="1" lon="2"/><gpx:rtept lat="1.1" lon="2.1"/></gpx:rte>
</gpx:gpx>`;
const f = parseGpx(foreign);
assert.equal(f.name, "Lesní okruh");
assert.equal(f.tracks[0].points.length, 3);
assert.equal(f.tracks[0].points[1].ele, 300);
assert.equal(f.routes[0].points.length, 2);
console.log("gpx ok");
