// Drives the navigation engine along a real BRouter route, with a detour to trigger rerouting.
// Run: node --require ./scripts/node-stubs.cjs --import tsx scripts/sim-nav.ts
import { useLocation } from "../src/location/store";
import { startNavigation, startTrackNavigation, stopNavigation } from "../src/navigation/engine";
import { useNav } from "../src/navigation/store";
import { computeRoutes } from "../src/routing/brouter";
import type { Route } from "../src/types";
import { pointAlong } from "../src/utils/geo";

declare const global: { __speech: string[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let ts = Date.now();

function setFix(lon: number, lat: number, speed: number) {
  ts += 1000;
  useLocation.setState({
    fix: { lon, lat, alt: 300, speed, course: null, accuracy: 5, altAccuracy: 5, ts },
    displaySpeed: speed,
  });
}

function flushSpeech(label: string) {
  for (const s of global.__speech.splice(0)) console.log(`  ${label.padEnd(18)} 🔊 ${s}`);
}

async function drive(route: Route, opts: { detourAt?: number; speed: number }) {
  let along = 0;
  let detoured = false;
  let steps = 0;
  while (!useNav.getState().arrived && steps++ < 5000) {
    const r = useNav.getState().route!;
    const prog = useNav.getState().progress;
    if (opts.detourAt != null && !detoured && (prog?.along ?? along) > opts.detourAt) {
      detoured = true;
      const p = pointAlong(r.coords, r.cumDist, prog!.along);
      console.log(`  -- detour at ${Math.round(prog!.along)} m`);
      for (let i = 1; i <= 6; i++) {
        setFix(p[0] + 0.0004 * i, p[1] + 0.0004 * i, opts.speed);
        flushSpeech(`detour ${i}`);
        while (useNav.getState().rerouting) await sleep(100);
      }
      await sleep(50);
      const nr = useNav.getState().route!;
      console.log(`  -- new route ${Math.round(nr.distance)} m, maneuvers ${nr.maneuvers.length}, legEnds ${nr.legEnds}`);
      along = 0;
      // continue from the start of the new route
      const q = useNav.getState().progress;
      along = q?.along ?? 0;
      continue;
    }
    along = (prog?.along ?? along) + opts.speed;
    const p = pointAlong(r.coords, r.cumDist, along);
    setFix(p[0], p[1], opts.speed);
    const pr = useNav.getState().progress;
    flushSpeech(`@${Math.round(pr?.along ?? 0)} m`);
  }
  const st = useNav.getState();
  console.log(`  arrived=${st.arrived} leg=${st.progress?.leg} remaining=${Math.round(st.progress?.remaining ?? -1)} steps=${steps}`);
}

async function main() {
  const a: [number, number] = [16.0736, 49.561];
  const stop: [number, number] = [16.052, 49.585];
  const b: [number, number] = [16.0385, 49.6108];
  const [route] = await computeRoutes([a, stop, b], "enduro", { alternatives: false });
  console.log(`route ${Math.round(route.distance)} m, ${route.maneuvers.length} maneuvers, legEnds ${route.legEnds}`);

  setFix(a[0], a[1], 0);
  startNavigation(route);
  flushSpeech("start");
  await drive(route, { detourAt: 2500, speed: 11 });
  stopNavigation();

  console.log("\ntrack navigation (GPX track = the same geometry, started 400 m away):");
  setFix(a[0] - 0.005, a[1], 0);
  await startTrackNavigation(route.coords);
  flushSpeech("start");
  const tr = useNav.getState().route!;
  console.log(`  track route ${Math.round(tr.distance)} m, maneuvers ${tr.maneuvers.map((m) => m.type).join(",")}`);
  await drive(tr, { speed: 13 });
  stopNavigation();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
