#!/usr/bin/env python3
"""
Writes out/catalog.json (list of downloadable regions with file sizes) and out/regions.geojson
(simplified polygons for the in-app "pick on map" view).
"""
import argparse
import datetime
import glob
import json
import os

FILES = {"map": "map.pmtiles", "outdoor": "outdoor.pmtiles", "terrain": "terrain.pmtiles", "search": "search.db"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", default="work")
    ap.add_argument("--out", default="out")
    ap.add_argument("--version", default=datetime.date.today().isoformat())
    a = ap.parse_args()

    regions, features = [], []
    online = {}
    for rj in sorted(glob.glob(os.path.join(a.work, "*", "boundaries", "regions.json"))):
        for r in json.load(open(rj, encoding="utf-8")):
            files, total = {}, 0
            for key, fn in FILES.items():
                p = os.path.join(a.out, "regions", r["id"], fn)
                if os.path.exists(p):
                    size = os.path.getsize(p)
                    files[key] = {"path": f"regions/{r['id']}/{fn}", "size": size}
                    total += size
            if "map" not in files:
                continue
            if r["kind"] == "country" and "outdoor" in files:
                online.setdefault("outdoor", files["outdoor"]["path"])
            regions.append({k: r[k] for k in ("id", "kind", "parent", "name", "bbox", "center")} |
                           {"files": files, "size": total, "version": a.version})
            features.append({"type": "Feature", "id": r["id"],
                             "properties": {"id": r["id"], "kind": r["kind"], "name_cs": r["name"]["cs"],
                                            "name_en": r["name"]["en"], "size": total},
                             "geometry": r["pick"]})

    catalog = {"version": a.version, "generated": datetime.datetime.utcnow().isoformat() + "Z",
               "online": online, "regions": regions}
    os.makedirs(a.out, exist_ok=True)
    json.dump(catalog, open(os.path.join(a.out, "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump({"type": "FeatureCollection", "features": features},
              open(os.path.join(a.out, "regions.geojson"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"catalog: {len(regions)} regions, version {a.version}")


if __name__ == "__main__":
    main()
