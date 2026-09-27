#!/usr/bin/env python3
"""
Offline search index (SQLite FTS5) per region from an `osmium export` GeoJSON sequence of named
OSM objects. The app opens the downloaded search.db read-only and queries the `search` table.

Schema:
  CREATE VIRTUAL TABLE search USING fts5(name, alt, city, kind UNINDEXED, cls UNINDEXED,
                                         lon UNINDEXED, lat UNINDEXED, prio UNINDEXED)
"""
import argparse
import json
import math
import os
import sqlite3

from shapely.geometry import Point, shape
from shapely.prepared import prep

PLACE_PRIO = {"city": 100, "town": 80, "village": 60, "suburb": 50, "hamlet": 40,
              "neighbourhood": 30, "locality": 25, "isolated_dwelling": 20, "quarter": 45}
STREET = {"motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential",
          "living_street", "pedestrian", "service", "track", "road"}
POI_KEYS = ["amenity", "shop", "tourism", "leisure", "historic", "natural", "man_made", "craft", "office",
            "healthcare", "railway", "aerialway"]
NATURAL = {"peak", "spring", "cave_entrance", "saddle", "volcano", "rock", "waterfall", "hill", "ridge"}
MAN_MADE = {"tower", "observation_tower", "water_tower", "lighthouse", "windmill", "watermill", "cross"}
RAILWAY = {"station", "halt"}


def read_seq(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip().lstrip("\x1e")
            if line:
                yield json.loads(line)


def centroid(geom):
    t = geom["type"]
    c = geom["coordinates"]
    if t == "Point":
        return c[0], c[1]
    if t == "LineString":
        m = c[len(c) // 2]
        return m[0], m[1]
    if t == "MultiLineString":
        m = c[0][len(c[0]) // 2]
        return m[0], m[1]
    try:
        p = shape(geom).representative_point()
        return p.x, p.y
    except Exception:  # noqa: BLE001
        return None


def classify(p):
    if p.get("place") in PLACE_PRIO:
        return "place", p["place"], PLACE_PRIO[p["place"]]
    hw = p.get("highway")
    if hw in STREET:
        return "street", hw, 10
    for k in POI_KEYS:
        v = p.get(k)
        if not v:
            continue
        if k == "natural" and v not in NATURAL:
            continue
        if k == "man_made" and v not in MAN_MADE:
            continue
        if k == "railway" and v not in RAILWAY:
            continue
        if k == "shop":
            return "poi", "shop" if v not in ("supermarket", "convenience", "motorcycle", "car_repair", "bakery") else v, 15
        return "poi", v, 20 if k in ("amenity", "tourism", "natural") else 15
    return None


class Grid:
    def __init__(self, cell=0.1):
        self.cell = cell
        self.d = {}

    def add(self, lon, lat, item):
        self.d.setdefault((int(lon / self.cell), int(lat / self.cell)), []).append((lon, lat, item))

    def nearest(self, lon, lat, max_km=8):
        cx, cy = int(lon / self.cell), int(lat / self.cell)
        best, bd = None, max_km
        k = math.cos(math.radians(lat)) * 111.32
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for x, y, it in self.d.get((cx + dx, cy + dy), ()):
                    d = math.hypot((x - lon) * k, (y - lat) * 110.57)
                    if d < bd:
                        best, bd = it, d
        return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--regions", required=True, help="regions.json from boundaries.py")
    ap.add_argument("--polydir", required=True, help="dir with <id>.geojson polygons")
    ap.add_argument("--outdir", required=True, help="writes <outdir>/<id>/search.db")
    a = ap.parse_args()

    rows, seen_streets = [], set()
    towns = Grid()
    for f in read_seq(a.input):
        p = f.get("properties") or {}
        name = p.get("name")
        if not name or not f.get("geometry"):
            continue
        cls = classify(p)
        if not cls:
            continue
        c = centroid(f["geometry"])
        if not c:
            continue
        kind, sub, prio = cls
        if kind == "street":
            key = (name, round(c[0], 2), round(c[1], 2))
            if key in seen_streets:
                continue
            seen_streets.add(key)
        alt = " ".join(v for k, v in p.items() if k in ("name:en", "name:de", "alt_name", "official_name", "old_name") and v)
        if kind == "place" and sub in ("city", "town", "village", "suburb", "hamlet"):
            towns.add(c[0], c[1], name)
        rows.append([name, alt, "", kind, sub, round(c[0], 6), round(c[1], 6), prio])

    for r in rows:
        if r[3] != "place" or r[4] in ("suburb", "neighbourhood", "quarter", "hamlet", "locality"):
            r[2] = towns.nearest(r[5], r[6]) or ""
            if r[2] == r[0]:
                r[2] = ""
    print(f"search: {len(rows)} named objects")

    regions = json.load(open(a.regions, encoding="utf-8"))
    for reg in regions:
        poly = json.load(open(os.path.join(a.polydir, f"{reg['id']}.geojson"), encoding="utf-8"))
        g = prep(shape(poly["geometry"]))
        w, s, e, n = reg["bbox"]
        sub = [r for r in rows if w <= r[5] <= e and s <= r[6] <= n and g.contains(Point(r[5], r[6]))]
        d = os.path.join(a.outdir, reg["id"])
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, "search.db")
        if os.path.exists(path):
            os.remove(path)
        db = sqlite3.connect(path)
        db.execute(
            "CREATE VIRTUAL TABLE search USING fts5(name, alt, city, kind UNINDEXED, cls UNINDEXED, "
            "lon UNINDEXED, lat UNINDEXED, prio UNINDEXED, tokenize = 'unicode61 remove_diacritics 2')"
        )
        db.executemany("INSERT INTO search VALUES (?, ?, ?, ?, ?, ?, ?, ?)", sub)
        db.execute("INSERT INTO search(search) VALUES('optimize')")
        db.commit()
        db.execute("VACUUM")
        db.close()
        print(f"  {reg['id']}: {len(sub)}")


if __name__ == "__main__":
    main()
