#!/usr/bin/env python3
"""
Builds region polygons (country / kraj / okres) from an `osmium export` GeoJSON sequence of
boundary=administrative areas.

Outputs:
  <outdir>/<id>.geojson   buffered polygon used for `pmtiles extract --region`
  <outdir>/regions.json   metadata list consumed by catalog.py
"""
import argparse
import json
import os
import re
import unicodedata

from shapely.geometry import mapping, shape
from shapely.ops import unary_union


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def read_seq(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip().lstrip("\x1e")
            if line:
                yield json.loads(line)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--country", required=True, help="country json object from countries.json")
    ap.add_argument("--outdir", required=True)
    a = ap.parse_args()
    c = json.loads(a.country)
    os.makedirs(a.outdir, exist_ok=True)

    country_geom = None
    regions, districts = [], []
    rre = re.compile(c.get("region_name_regex", "."), re.I)
    dre = re.compile(c.get("district_name_regex", "."), re.I)
    for f in read_seq(a.input):
        p = f.get("properties") or {}
        lvl = str(p.get("admin_level", ""))
        name = p.get("name")
        if not name or f.get("geometry") is None or f["geometry"]["type"] not in ("Polygon", "MultiPolygon"):
            continue
        try:
            g = shape(f["geometry"]).buffer(0)
        except Exception:  # noqa: BLE001
            continue
        if g.is_empty:
            continue
        if lvl == "2" and (p.get("ISO3166-1") == c["iso"] or p.get("ISO3166-1:alpha2") == c["iso"]):
            country_geom = g
        elif lvl == c["region_level"] and rre.search(name):
            regions.append((name, p.get("name:en") or name, g))
        elif lvl == c["district_level"] and dre.search(name):
            districts.append((name, p.get("name:en") or name, g))

    if country_geom is None:
        country_geom = unary_union([g for _, _, g in regions])
    regions = [r for r in regions if country_geom.buffer(0.01).contains(r[2].representative_point())]
    districts = [d for d in districts if country_geom.buffer(0.01).contains(d[2].representative_point())]

    out = []

    def emit(rid, kind, name_cs, name_en, g, parent=None):
        ext = g.simplify(0.0005, preserve_topology=True).buffer(0.01, join_style=2)
        with open(os.path.join(a.outdir, f"{rid}.geojson"), "w", encoding="utf-8") as fh:
            json.dump({"type": "Feature", "properties": {"id": rid}, "geometry": mapping(ext)}, fh)
        pick = g.simplify(0.004, preserve_topology=True)
        out.append({
            "id": rid,
            "kind": kind,
            "parent": parent,
            "name": {"cs": name_cs, "en": name_en},
            "bbox": [round(v, 5) for v in ext.bounds],
            "center": [round(v, 5) for v in (g.representative_point().x, g.representative_point().y)],
            "pick": mapping(pick),
        })

    emit(c["id"], "country", c["name"]["cs"], c["name"]["en"], country_geom)
    region_ids = []
    for name, name_en, g in sorted(regions, key=lambda r: r[0]):
        rid = f"{c['id']}-{slug(name)}"
        region_ids.append((rid, g))
        emit(rid, "region", name, name_en, g, c["id"])
    for name, name_en, g in sorted(districts, key=lambda r: r[0]):
        pt = g.representative_point()
        parent = next((rid for rid, rg in region_ids if rg.contains(pt)), c["id"])
        emit(f"{c['id']}-{slug(name)}", "district", name, name_en, g, parent)

    with open(os.path.join(a.outdir, "regions.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    print(f"{c['id']}: 1 country, {len(regions)} regions, {len(districts)} districts")


if __name__ == "__main__":
    main()
