#!/usr/bin/env bash
# Builds offline map data for every enabled country in countries.json:
#   out/regions/<id>/{map,outdoor,terrain}.pmtiles + search.db   (country, kraje, okresy)
#   out/catalog.json, out/regions.geojson
#
# Needs: java 21, osmium-tool, gdal-bin (+python3-gdal), python3 (numpy scipy pillow shapely),
#        tippecanoe/tile-join (felt), pmtiles CLI, jq, curl.
# Env:   ONLY=cz,sk            build only these ids (ignores "enabled")
#        TERRAIN_MAXZOOM=11    offline hillshade detail (12 = ~4x larger)
#        CONTOUR_ZOOM=12       DEM zoom used for contours
#        JAVA_MEM=6g
set -euo pipefail
cd "$(dirname "$0")"

WORK=work
OUT=out
TERRAIN_MAXZOOM=${TERRAIN_MAXZOOM:-11}
CONTOUR_ZOOM=${CONTOUR_ZOOM:-12}
JAVA_MEM=${JAVA_MEM:-6g}
ONLY=${ONLY:-}
PLANETILER="$PWD/$WORK/planetiler.jar"

mkdir -p "$WORK" "$OUT/regions"
[ -f "$PLANETILER" ] || curl -fL -o "$PLANETILER" https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar

log() { echo -e "\n\033[1;36m==> $*\033[0m"; }

mapfile -t COUNTRIES < <(jq -c '.[]' countries.json)
for C in "${COUNTRIES[@]}"; do
  ID=$(jq -r .id <<<"$C")
  if [ -n "$ONLY" ]; then [[ ",$ONLY," == *",$ID,"* ]] || continue
  else [ "$(jq -r .enabled <<<"$C")" = "true" ] || continue; fi
  GF=$(jq -r .geofabrik <<<"$C")
  W="$PWD/$WORK/$ID"
  mkdir -p "$W"

  log "$ID: OSM extract"
  [ -s "$W/area.osm.pbf" ] || curl -fL -o "$W/area.osm.pbf" "https://download.geofabrik.de/$GF-latest.osm.pbf"

  log "$ID: boundaries (kraje / okresy)"
  osmium tags-filter "$W/area.osm.pbf" r/boundary=administrative -O -o "$W/bnd.osm.pbf"
  osmium export "$W/bnd.osm.pbf" -O -f geojsonseq --geometry-types=polygon -o "$W/bnd.geojsonseq"
  python3 boundaries.py --input "$W/bnd.geojsonseq" --country "$C" --outdir "$W/boundaries"
  BBOX=$(jq -r --arg id "$ID" '.[] | select(.id==$id) | .bbox | map(tostring) | join(" ")' "$W/boundaries/regions.json")
  echo "bbox: $BBOX"

  log "$ID: basemap (Planetiler, OpenMapTiles schema)"
  (cd "$WORK" && java -Xmx"$JAVA_MEM" -jar "$PLANETILER" \
    --osm-path="$W/area.osm.pbf" --download --output="$W/map.pmtiles" --force \
    --languages=cs,en,de,sk,pl --maxzoom=14)

  log "$ID: outdoor overlay (tracktype, access, maxspeed)"
  (cd "$WORK" && java -Xmx"$JAVA_MEM" -jar "$PLANETILER" generate-custom \
    --schema="$PWD/../outdoor.yml" --osm_path="$W/area.osm.pbf" --output="$W/tracks.mbtiles" --force)

  log "$ID: terrain (Terrarium DEM) + contours"
  python3 terrain.py --bbox $BBOX --maxzoom "$TERRAIN_MAXZOOM" --cache "$WORK/terrarium" \
    --mbtiles "$W/terrain.mbtiles" --dem-tif "$W/dem.tif" --dem-zoom "$CONTOUR_ZOOM"
  rm -f "$W/terrain.pmtiles" && pmtiles convert "$W/terrain.mbtiles" "$W/terrain.pmtiles"
  rm -f "$W/contours.gpkg" "$W/contours.geojsons"
  gdal_contour -q -a ele -i 10 -f GPKG "$W/dem.tif" "$W/contours.gpkg"
  ogr2ogr -f GeoJSONSeq -t_srs EPSG:4326 -dialect SQLite \
    -sql "SELECT CAST(ROUND(ele) AS INTEGER) AS ele, CASE WHEN CAST(ROUND(ele) AS INTEGER) % 100 = 0 THEN 100 WHEN CAST(ROUND(ele) AS INTEGER) % 50 = 0 THEN 50 ELSE 10 END AS idx, geom FROM contour" \
    "$W/contours.geojsons" "$W/contours.gpkg"
  tippecanoe -q -o "$W/contours.mbtiles" --force -l contours -Z11 -z14 \
    -j '{"contours":["any",[">=","$zoom",13],["in","idx",50,100]]}' \
    --simplification=4 --no-tile-size-limit --no-feature-limit \
    --attribute-type=ele:int --attribute-type=idx:int "$W/contours.geojsons"
  rm -f "$W/outdoor.pmtiles"
  tile-join -q -o "$W/outdoor.pmtiles" --force --no-tile-size-limit "$W/tracks.mbtiles" "$W/contours.mbtiles"

  log "$ID: region extracts"
  for R in $(jq -r '.[].id' "$W/boundaries/regions.json"); do
    D="$OUT/regions/$R"
    mkdir -p "$D"
    for F in map outdoor terrain; do
      rm -f "$D/$F.pmtiles"
      if [ "$R" = "$ID" ]; then
        ln -f "$W/$F.pmtiles" "$D/$F.pmtiles" 2>/dev/null || cp "$W/$F.pmtiles" "$D/$F.pmtiles"
      else
        pmtiles extract "$W/$F.pmtiles" "$D/$F.pmtiles" --region="$W/boundaries/$R.geojson" >/dev/null
      fi
    done
    echo "  $R: $(du -sh "$D" | cut -f1)"
  done

  log "$ID: offline search index"
  osmium tags-filter "$W/area.osm.pbf" nwr/name -O -o "$W/named.osm.pbf"
  osmium export "$W/named.osm.pbf" -O -f geojsonseq -o "$W/named.geojsonseq"
  python3 search_index.py --input "$W/named.geojsonseq" --regions "$W/boundaries/regions.json" \
    --polydir "$W/boundaries" --outdir "$OUT/regions"
done

log "catalog"
python3 catalog.py --work "$WORK" --out "$OUT"
du -sh "$OUT"
