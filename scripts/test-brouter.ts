// Uploads the custom profiles to BRouter, routes a sample trip and checks the app's parser.
// Run: node --require ./scripts/node-stubs.cjs --import tsx scripts/test-brouter.ts
import { computeRoutes } from "../src/routing/brouter";
import { CUSTOM_PROFILES, profileSource } from "../src/routing/profiles";

const BASE = process.env.BROUTER ?? "https://brouter.de/brouter";
// Vysočina forest tracks between Nové Město na Moravě and Tři Studně
const LONLATS = "16.0736,49.5610|16.0385,49.6108";

async function main() {
  for (const id of CUSTOM_PROFILES) {
    for (const respect of [true, false]) {
      const res = await fetch(`${BASE}/profile`, { method: "POST", body: profileSource(id, respect) });
      const up = (await res.json()) as { profileid?: string; error?: string };
      if (!up.profileid || up.error) {
        console.log(id, respect, "UPLOAD ERROR", up.error ?? up);
        continue;
      }
      const r = await fetch(`${BASE}?lonlats=${LONLATS}&profile=${up.profileid}&alternativeidx=0&format=geojson&timode=3`);
      const text = await r.text();
      if (!r.ok || !text.startsWith("{")) {
        console.log(id, respect, "ROUTE ERROR", text.slice(0, 200));
        continue;
      }
      const f = JSON.parse(text).features[0];
      const msgs: string[][] = f.properties.messages.slice(1);
      const byType: Record<string, number> = {};
      for (const m of msgs) {
        const hw = /highway=(\S+)/.exec(m[9])?.[1] ?? "?";
        const tt = /tracktype=(\S+)/.exec(m[9])?.[1];
        const k = tt ? `${hw}/${tt}` : hw;
        byType[k] = (byType[k] ?? 0) + Number(m[3]);
      }
      console.log(
        `${id.padEnd(10)} access=${respect ? "on " : "off"} ${f.properties["track-length"]} m, ${f.properties["total-time"]} s, hints ${f.properties.voicehints?.length ?? 0}`,
        JSON.stringify(byType),
      );
    }
  }

  const pts = LONLATS.split("|").map((s) => s.split(",").map(Number) as [number, number]);
  const routes = await computeRoutes([pts[0], [16.052, 49.585], pts[1]], "enduro", { alternatives: false });
  const r = routes[0];
  const bySurface: Record<string, number> = {};
  for (const s of r.segments) bySurface[s.surface] = (bySurface[s.surface] ?? 0) + r.cumDist[s.to] - r.cumDist[s.from];
  console.log("\nparsed enduro route with a stop:");
  console.log(`  ${Math.round(r.distance)} m, ${Math.round(r.duration / 60)} min, +${r.ascent}/-${Math.round(r.descent)} m, legEnds ${r.legEnds}`);
  console.log("  surfaces", Object.fromEntries(Object.entries(bySurface).map(([k, v]) => [k, Math.round(v)])));
  console.log("  maneuvers", r.maneuvers.map((m) => `${m.type}${m.exit ? m.exit : ""}@${Math.round(m.at)}`).join(" "));
  console.log("  maxspeeds", [...new Set(r.segments.map((s) => s.maxspeed).filter(Boolean))]);

  const alts = await computeRoutes([[16.6068, 49.1951], [16.54, 49.26]], "moto_curvy", { alternatives: true });
  console.log(`\nmoto_curvy Brno alternatives: ${alts.map((a) => Math.round(a.distance)).join(", ")} m`);
}

main();
