/**
 * Browser-preview stand-in for @maplibre/maplibre-react-native, built on maplibre-gl.
 * Aliased in metro.config.js for platform "web" only; native builds never see this file.
 */
import "maplibre-gl/dist/maplibre-gl.css";

import { Asset } from "expo-asset";
import * as maplibregl from "maplibre-gl";
import {
  createContext,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { View, type ViewStyle } from "react-native";

import { useLocation } from "@/location/store";

maplibregl.setWorkerUrl(new URL("/maplibre/maplibre-gl-worker.mjs", window.location.href).href);

type LngLat = [number, number];
type Padding = { top?: number; right?: number; bottom?: number; left?: number };
type Evt<T> = { nativeEvent: T };

interface Ctx {
  map: maplibregl.Map | null;
  version: number;
}
const MapCtx = createContext<Ctx>({ map: null, version: 0 });
const SourceCtx = createContext<string | null>(null);

// ---------------------------------------------------------------- images

const imageCache = new globalThis.Map<string, { img: HTMLImageElement; pixelRatio: number }>();
let imagesPending: Promise<void> = Promise.resolve();
const registered = new Set<string>();

function registerImages(images: Record<string, number>) {
  const jobs: Promise<void>[] = [];
  for (const [name, mod] of Object.entries(images)) {
    if (registered.has(name)) continue;
    registered.add(name);
    jobs.push(
      (async () => {
        const asset = Asset.fromModule(mod);
        const img = new Image();
        img.src = asset.uri;
        await img.decode().catch(() => undefined);
        const pixelRatio = asset.width ? Math.max(1, Math.round(img.naturalWidth / asset.width)) : 1;
        imageCache.set(name, { img, pixelRatio });
      })(),
    );
  }
  if (jobs.length) imagesPending = Promise.all([imagesPending, ...jobs]).then(() => undefined);
}

function addCachedImages(map: maplibregl.Map) {
  for (const [name, { img, pixelRatio }] of imageCache) {
    if (!map.hasImage(name) && img.naturalWidth) map.addImage(name, img, { pixelRatio });
  }
}

export function Images({ images }: { images: Record<string, number> }) {
  registerImages(images);
  const { map, version } = useContext(MapCtx);
  useEffect(() => {
    if (!map) return;
    let alive = true;
    imagesPending.then(() => {
      if (alive) addCachedImages(map);
    });
    return () => {
      alive = false;
    };
  }, [map, version, images]);
  return null;
}

// ---------------------------------------------------------------- map

export interface MapRef {
  queryRenderedFeatures(
    geometry: [number, number] | [[number, number], [number, number]],
    opts?: { layers?: string[] },
  ): Promise<GeoJSON.Feature[]>;
}

interface MapProps {
  ref?: Ref<MapRef>;
  style?: ViewStyle | ViewStyle[] | object;
  mapStyle: object | string;
  children?: ReactNode;
  onPress?: (e: Evt<{ point: [number, number]; lngLat: LngLat }>) => void;
  onLongPress?: (e: Evt<{ point: [number, number]; lngLat: LngLat }>) => void;
  onRegionDidChange?: (e: Evt<{ center: LngLat; zoom: number; bearing: number; pitch: number }>) => void;
  attribution?: boolean;
  contentInset?: Padding;
  [key: string]: unknown;
}

export function Map({ ref, style, mapStyle, children, onPress, onLongPress, onRegionDidChange, attribution, contentInset }: MapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const [ctx, setCtx] = useState<Ctx>({ map: null, version: 0 });
  const handlers = useRef({ onPress, onLongPress, onRegionDidChange });
  handlers.current = { onPress, onLongPress, onRegionDidChange };
  const firstStyle = useRef(mapStyle);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: firstStyle.current as maplibregl.StyleSpecification,
      attributionControl: attribution === false ? false : { compact: true },
      center: [15.5, 49.8],
      zoom: 6,
      dragRotate: true,
      pitchWithRotate: true,
    });
    let version = 0;
    map.on("styleimagemissing", (e) => {
      const hit = imageCache.get(e.id);
      if (hit && !map.hasImage(e.id)) map.addImage(e.id, hit.img, { pixelRatio: hit.pixelRatio });
    });
    map.on("style.load", () => {
      imagesPending.then(() => {
        addCachedImages(map);
        setCtx({ map, version: ++version });
      });
    });

    const toEvt = (e: maplibregl.MapMouseEvent) => ({
      nativeEvent: { point: [e.point.x, e.point.y] as [number, number], lngLat: [e.lngLat.lng, e.lngLat.lat] as LngLat },
    });
    let longPressed = false;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    const cancelHold = () => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
    };
    map.on("mousedown", (e) => {
      longPressed = false;
      cancelHold();
      holdTimer = setTimeout(() => {
        longPressed = true;
        handlers.current.onLongPress?.(toEvt(e));
      }, 550);
    });
    map.on("touchstart", (e) => {
      longPressed = false;
      cancelHold();
      if (e.points.length !== 1) return;
      holdTimer = setTimeout(() => {
        longPressed = true;
        handlers.current.onLongPress?.(toEvt(e as unknown as maplibregl.MapMouseEvent));
      }, 550);
    });
    for (const ev of ["mouseup", "dragstart", "touchend", "touchmove", "zoomstart", "rotatestart"] as const) {
      map.on(ev, cancelHold);
    }
    map.on("contextmenu", (e) => {
      cancelHold();
      longPressed = true;
      handlers.current.onLongPress?.(toEvt(e));
    });
    map.on("click", (e) => {
      if (longPressed) {
        longPressed = false;
        return;
      }
      handlers.current.onPress?.(toEvt(e));
    });
    map.on("moveend", () => {
      const c = map.getCenter();
      handlers.current.onRegionDidChange?.({
        nativeEvent: { center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() },
      });
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container.current!);
    return () => {
      ro.disconnect();
      cancelHold();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { map } = ctx;
  useEffect(() => {
    if (!map || mapStyle === firstStyle.current) return;
    firstStyle.current = mapStyle;
    map.setStyle(mapStyle as maplibregl.StyleSpecification, { diff: false });
  }, [map, mapStyle]);

  useEffect(() => {
    if (!map) return;
    map.easeTo({ padding: { top: 0, right: 0, bottom: 0, left: 0, ...contentInset }, duration: 300 });
  }, [map, contentInset]);

  useImperativeHandle(
    ref,
    () => ({
      async queryRenderedFeatures(geometry, opts) {
        if (!map) return [];
        const layers = opts?.layers?.filter((id) => map.getLayer(id));
        if (opts?.layers && !layers?.length) return [];
        const geom = geometry as maplibregl.PointLike | [maplibregl.PointLike, maplibregl.PointLike];
        return map.queryRenderedFeatures(geom, layers ? { layers } : undefined).map((f) => ({
          type: "Feature" as const,
          id: f.id,
          properties: f.properties,
          geometry: f.geometry,
        }));
      },
    }),
    [map],
  );

  return (
    <View style={style as ViewStyle}>
      <div ref={container} style={{ position: "absolute", inset: 0 }} />
      <MapCtx.Provider value={ctx}>{ctx.map ? children : null}</MapCtx.Provider>
    </View>
  );
}

// ---------------------------------------------------------------- camera

export type TrackUserLocation = "default" | "heading" | "course";

export interface CameraRef {
  flyTo(o: { center: LngLat; zoom?: number; duration?: number }): void;
  easeTo(o: { center?: LngLat; zoom?: number; bearing?: number; pitch?: number; duration?: number }): void;
  fitBounds(bbox: [number, number, number, number], o?: { padding?: Padding; duration?: number }): void;
}

const initialised = new WeakSet<maplibregl.Map>();

export function Camera({
  ref,
  initialViewState,
  minZoom,
  maxZoom,
  trackUserLocation,
  onTrackUserLocationChange,
}: {
  ref?: Ref<CameraRef>;
  initialViewState?: { center: LngLat; zoom?: number };
  minZoom?: number;
  maxZoom?: number;
  trackUserLocation?: TrackUserLocation;
  onTrackUserLocationChange?: (e: Evt<{ trackUserLocation: TrackUserLocation | null }>) => void;
}) {
  const { map } = useContext(MapCtx);
  const onChange = useRef(onTrackUserLocationChange);
  onChange.current = onTrackUserLocationChange;

  useEffect(() => {
    if (!map || initialised.has(map)) return;
    initialised.add(map);
    if (initialViewState) map.jumpTo({ center: initialViewState.center, zoom: initialViewState.zoom });
  }, [map, initialViewState]);

  useEffect(() => {
    if (!map) return;
    if (minZoom != null) map.setMinZoom(minZoom);
    if (maxZoom != null) map.setMaxZoom(maxZoom);
  }, [map, minZoom, maxZoom]);

  useEffect(() => {
    if (!map || !trackUserLocation) return;
    const follow = (first: boolean) => {
      const { fix, heading } = useLocation.getState();
      if (!fix) return;
      const bearing =
        trackUserLocation === "course" ? (fix.course ?? map.getBearing()) : trackUserLocation === "heading" ? (heading ?? map.getBearing()) : undefined;
      map.easeTo({ center: [fix.lon, fix.lat], bearing, zoom: first ? Math.max(map.getZoom(), 15) : undefined, duration: first ? 700 : 900 });
    };
    follow(true);
    const unsub = useLocation.subscribe((s, prev) => {
      if (s.fix !== prev.fix || s.heading !== prev.heading) follow(false);
    });
    const stop = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) onChange.current?.({ nativeEvent: { trackUserLocation: null } });
    };
    map.on("dragstart", stop);
    return () => {
      unsub();
      map.off("dragstart", stop);
    };
  }, [map, trackUserLocation]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: ({ center, zoom, duration }) => map?.flyTo({ center, zoom, duration }),
      easeTo: ({ center, zoom, bearing, pitch, duration }) => map?.easeTo({ center, zoom, bearing, pitch, duration }),
      fitBounds: (bbox, o) =>
        map?.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: { top: 0, right: 0, bottom: 0, left: 0, ...o?.padding }, duration: o?.duration },
        ),
    }),
    [map],
  );
  return null;
}

// ---------------------------------------------------------------- sources & layers

export function GeoJSONSource({
  id,
  data,
  lineMetrics,
  children,
}: {
  id: string;
  data: GeoJSON.GeoJSON | string;
  lineMetrics?: boolean;
  children?: ReactNode;
}) {
  const { map, version } = useContext(MapCtx);
  const [ready, setReady] = useState<number | null>(null);
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    if (!map) return;
    if (!map.getSource(id)) {
      map.addSource(id, { type: "geojson", data: latest.current as GeoJSON.GeoJSON, lineMetrics });
    }
    setReady(version);
    return () => {
      setReady(null);
      try {
        for (const l of map.getStyle()?.layers ?? []) {
          if ("source" in l && l.source === id) map.removeLayer(l.id);
        }
        if (map.getSource(id)) map.removeSource(id);
      } catch {
        // map already removed or style being replaced
      }
    };
  }, [map, version, id, lineMetrics]);

  useEffect(() => {
    const src = map?.getSource(id) as maplibregl.GeoJSONSource | undefined;
    src?.setData(data as GeoJSON.GeoJSON);
  }, [map, id, data]);

  return <SourceCtx.Provider value={id}>{ready === version ? children : null}</SourceCtx.Provider>;
}

type LayerProps = {
  id: string;
  type: string;
  source?: string;
  "source-layer"?: string;
  beforeId?: string;
  filter?: unknown;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  minzoom?: number;
  maxzoom?: number;
  [key: string]: unknown;
};

export function Layer({ id, beforeId, ...rest }: LayerProps) {
  const { map, version } = useContext(MapCtx);
  const ctxSource = useContext(SourceCtx);
  const spec = JSON.stringify({ ...rest, source: rest.source ?? ctxSource ?? undefined });

  useEffect(() => {
    if (!map) return;
    const layer = JSON.parse(spec) as maplibregl.LayerSpecification;
    try {
      if (map.getLayer(id)) map.removeLayer(id);
      map.addLayer({ ...layer, id }, beforeId && map.getLayer(beforeId) ? beforeId : undefined);
    } catch (err) {
      console.warn(`[map-shim] layer ${id}:`, (err as Error).message);
    }
    return () => {
      try {
        if (map.getLayer(id)) map.removeLayer(id);
      } catch {
        // map already removed or style being replaced
      }
    };
  }, [map, version, id, beforeId, spec]);
  return null;
}

// ---------------------------------------------------------------- user location

export function NativeUserLocation({ mode }: { mode?: "default" | "heading" | "course" }) {
  const { map } = useContext(MapCtx);
  useEffect(() => {
    if (!map) return;
    const el = document.createElement("div");
    el.style.cssText = "width:22px;height:22px;position:relative;pointer-events:none";
    el.innerHTML =
      '<div data-cone style="position:absolute;left:-9px;top:-22px;width:40px;height:40px;' +
      "background:conic-gradient(from -30deg,rgba(0,174,255,.45) 0deg 60deg,transparent 60deg);" +
      'border-radius:50%;display:none"></div>' +
      '<div style="position:absolute;inset:0;border-radius:50%;background:#1E90FF;border:3px solid #fff;' +
      'box-shadow:0 0 0 6px rgba(30,144,255,.25),0 1px 4px rgba(0,0,0,.5)"></div>';
    const cone = el.querySelector<HTMLDivElement>("[data-cone]")!;
    cone.style.top = "-9px";
    const marker = new maplibregl.Marker({ element: el, rotationAlignment: "map", pitchAlignment: "map" });
    const update = () => {
      const { fix, heading } = useLocation.getState();
      if (!fix) {
        marker.remove();
        return;
      }
      marker.setLngLat([fix.lon, fix.lat]);
      if (!marker.getElement().isConnected) marker.addTo(map);
      const dir = mode === "course" ? fix.course : heading;
      cone.style.display = dir == null ? "none" : "block";
      cone.style.transform = `rotate(${dir ?? 0}deg)`;
    };
    update();
    const unsub = useLocation.subscribe(update);
    return () => {
      unsub();
      marker.remove();
    };
  }, [map, mode]);
  return null;
}

export const UserLocation = NativeUserLocation;
