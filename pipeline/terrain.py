#!/usr/bin/env python3
"""
Terrarium DEM (AWS Open Data, s3://elevation-tiles-prod/terrarium) for a bounding box.

  1. downloads Terrarium PNG tiles z0..maxzoom into a cache dir
  2. writes them into an MBTiles file (converted to PMTiles by the caller) -> offline hillshade
  3. optionally writes a smoothed GeoTIFF (EPSG:3857) at --dem-zoom for gdal_contour

Elevation (m) = R * 256 + G + B / 256 - 32768
"""
import argparse
import math
import os
import sqlite3
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
ORIGIN = 20037508.342789244


def lonlat_to_tile(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(max(min(lat, 85.0511), -85.0511))
    y = int((1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def tile_range(bbox, z):
    w, s, e, n = bbox
    x0, y0 = lonlat_to_tile(w, n, z)
    x1, y1 = lonlat_to_tile(e, s, z)
    return x0, x1, y0, y1


def fetch(cache, z, x, y):
    path = os.path.join(cache, str(z), str(x), f"{y}.png")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for attempt in range(5):
        try:
            req = urllib.request.Request(URL.format(z=z, x=x, y=y), headers={"User-Agent": "MojeMapy-pipeline"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            tmp = path + ".part"
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, path)
            return path
        except Exception as ex:  # noqa: BLE001
            if attempt == 4:
                print(f"failed {z}/{x}/{y}: {ex}", file=sys.stderr)
                return None
            time.sleep(1.5 * (attempt + 1))


def download(bbox, maxzoom, cache, threads):
    jobs = []
    for z in range(0, maxzoom + 1):
        x0, x1, y0, y1 = tile_range(bbox, z)
        jobs += [(z, x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    print(f"terrarium: {len(jobs)} tiles z0-{maxzoom}")
    done = 0
    with ThreadPoolExecutor(threads) as ex:
        for _ in ex.map(lambda j: fetch(cache, *j), jobs):
            done += 1
            if done % 500 == 0:
                print(f"  {done}/{len(jobs)}")
    return jobs


def write_mbtiles(jobs, cache, out, bbox, maxzoom):
    if os.path.exists(out):
        os.remove(out)
    db = sqlite3.connect(out)
    db.execute("CREATE TABLE metadata (name TEXT, value TEXT)")
    db.execute("CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)")
    db.execute("CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)")
    meta = {
        "name": "terrain",
        "format": "png",
        "type": "baselayer",
        "minzoom": "0",
        "maxzoom": str(maxzoom),
        "bounds": ",".join(f"{v:.5f}" for v in bbox),
        "attribution": "Mapzen Terrarium (AWS Open Data): SRTM, GMTED, ETOPO1, EU-DEM and others",
        "description": "terrarium-encoded DEM",
    }
    db.executemany("INSERT INTO metadata VALUES (?, ?)", meta.items())
    for z, x, y in jobs:
        p = os.path.join(cache, str(z), str(x), f"{y}.png")
        if not os.path.exists(p):
            continue
        with open(p, "rb") as f:
            db.execute("INSERT INTO tiles VALUES (?, ?, ?, ?)", (z, x, (2 ** z - 1) - y, f.read()))
    db.commit()
    db.close()
    print(f"wrote {out}")


def write_dem_tif(bbox, z, cache, out, sigma):
    import numpy as np
    from osgeo import gdal
    from PIL import Image
    from scipy.ndimage import gaussian_filter

    x0, x1, y0, y1 = tile_range(bbox, z)
    cols, rows = x1 - x0 + 1, y1 - y0 + 1
    size = 2 * ORIGIN / 2 ** z
    res = size / 256
    minx = -ORIGIN + x0 * size
    maxy = ORIGIN - y0 * size
    drv = gdal.GetDriverByName("GTiff")
    ds = drv.Create(out, cols * 256, rows * 256, 1, gdal.GDT_Float32,
                    options=["COMPRESS=DEFLATE", "TILED=YES", "BIGTIFF=IF_SAFER", "PREDICTOR=3"])
    ds.SetGeoTransform([minx, res, 0, maxy, 0, -res])
    ds.SetProjection('PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1],AUTHORITY["EPSG","3857"]]')
    band = ds.GetRasterBand(1)
    band.SetNoDataValue(-9999)

    def strip(r):
        r = max(0, min(rows - 1, r))
        arr = np.zeros((256, cols * 256), dtype=np.float32)
        for c in range(cols):
            p = os.path.join(cache, str(z), str(x0 + c), f"{y0 + r}.png")
            if not os.path.exists(p):
                continue
            px = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)
            arr[:, c * 256:(c + 1) * 256] = px[:, :, 0] * 256 + px[:, :, 1] + px[:, :, 2] / 256 - 32768
        return arr

    pad = 32
    prev, cur = strip(-1), strip(0)
    for r in range(rows):
        nxt = strip(r + 1)
        block = np.vstack([prev[-pad:], cur, nxt[:pad]])
        if sigma > 0:
            block = gaussian_filter(block, sigma=sigma, mode="nearest")
        band.WriteArray(block[pad:pad + 256], 0, r * 256)
        prev, cur = cur, nxt
    band.FlushCache()
    ds = None
    print(f"wrote {out} ({cols * 256}x{rows * 256})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", nargs=4, type=float, required=True, metavar=("W", "S", "E", "N"))
    ap.add_argument("--maxzoom", type=int, default=12)
    ap.add_argument("--cache", default="work/terrarium")
    ap.add_argument("--mbtiles", required=True)
    ap.add_argument("--dem-tif")
    ap.add_argument("--dem-zoom", type=int, default=12)
    ap.add_argument("--sigma", type=float, default=1.6)
    ap.add_argument("--threads", type=int, default=32)
    a = ap.parse_args()

    zmax = max(a.maxzoom, a.dem_zoom if a.dem_tif else 0)
    jobs = download(a.bbox, zmax, a.cache, a.threads)
    write_mbtiles([j for j in jobs if j[0] <= a.maxzoom], a.cache, a.mbtiles, a.bbox, a.maxzoom)
    if a.dem_tif:
        write_dem_tif(a.bbox, a.dem_zoom, a.cache, a.dem_tif, a.sigma)


if __name__ == "__main__":
    main()
