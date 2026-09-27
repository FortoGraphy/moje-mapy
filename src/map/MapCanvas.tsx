import {
  Camera,
  Images,
  Layer,
  Map,
  NativeUserLocation,
  type PixelPointBounds,
  type PressEvent,
  type TrackUserLocation,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type NativeSyntheticEvent, StyleSheet, useWindowDimensions } from "react-native";

import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/config";
import { t, useLang } from "@/i18n";
import { useNav } from "@/navigation/store";
import { useOffline } from "@/offline/store";
import { useRouting } from "@/routing/store";
import { useSettings } from "@/store/settings";
import { type FollowMode, useUi } from "@/store/ui";
import { colors } from "@/theme";
import type { Place } from "@/types";
import { uid } from "@/utils/format";
import { useOnline } from "@/utils/online";

import { cameraRef, mapRef } from "./controller";
import { glyphsUrl } from "./glyphs";
import { MAP_ICONS } from "./icons.generated";
import { RouteLayers } from "./layers/RouteLayers";
import { PinLayers } from "./layers/PinLayers";
import { TrackLayers } from "./layers/TrackLayers";
import { POI_CLASS_TO_CATEGORY } from "./poiCategories";
import { regionAt, resolveSources } from "./sources";
import { buildStyle } from "./style/buildStyle";
import {
  accessFallbackLayer,
  accessLayers,
  buildings3dLayer,
  contourLayers,
  maxspeedQueryLayer,
  type OverlayLayer,
  poiLayers,
  trackFallbackLayers,
  trackLayers,
} from "./style/overlays";
import { PALETTES } from "./style/palette";

const TRACKING: Record<FollowMode, TrackUserLocation | undefined> = {
  off: undefined,
  follow: "default",
  heading: "heading",
  course: "course",
};

const TAPPABLE = [
  "ov-poi-priority",
  "ov-poi-major",
  "ov-poi-all",
  "label-peak",
  "label-village",
  "label-town",
  "label-city",
  "label-place-minor",
  "route-alt",
];

function OverlayLayers({ layers }: { layers: OverlayLayer[] }) {
  return (
    <>
      {layers.map(({ id, ...props }) => (
        <Layer key={id} id={id} {...(props as object)} type={props.type as never} />
      ))}
    </>
  );
}

function featureToPlace(f: GeoJSON.Feature, lang: string): Place | null {
  const p = (f.properties ?? {}) as Record<string, string | number | undefined>;
  const name = (p[`name:${lang}`] ?? p.name) as string | undefined;
  if (!name || f.geometry.type !== "Point") return null;
  const [lon, lat] = f.geometry.coordinates;
  const cls = String(p.class ?? "");
  const cat = POI_CLASS_TO_CATEGORY[cls];
  const subtitle = p.ele
    ? `${p.ele} m`
    : cat
      ? t(`map.poiCat.${cat}`)
      : ["village", "town", "city", "hamlet", "suburb"].includes(cls)
        ? undefined
        : String(p.subclass ?? cls).replace(/_/g, " ");
  return {
    id: `f-${f.id ?? uid()}`,
    name,
    subtitle,
    lon,
    lat,
    category: cls,
    tags: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
  };
}

export const MapCanvas = memo(function MapCanvas() {
  const lang = useLang();
  const online = useOnline();
  const { height } = useWindowDimensions();

  const styleId = useSettings((s) => s.mapStyle);
  const overlays = useSettings((s) => s.overlays);
  const poiCategories = useSettings((s) => s.poiCategories);
  const textScale = useSettings((s) => s.textScale);
  const preferOffline = useSettings((s) => s.preferOffline);

  const follow = useUi((s) => s.follow);
  const navActive = useNav((s) => s.active);

  const catalog = useOffline((s) => s.catalog);
  const downloaded = useOffline((s) => s.downloaded);

  const [initial] = useState(() => {
    const last = useSettings.getState().lastCamera;
    return last ?? { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  });
  const [regionId, setRegionId] = useState<string | null>(() => regionAt(downloaded, initial.center)?.id ?? null);

  const region = useMemo(() => downloaded.find((r) => r.id === regionId) ?? null, [downloaded, regionId]);
  const resolved = useMemo(
    () => resolveSources({ region, online, preferOffline, catalog }),
    [region, online, preferOffline, catalog],
  );
  const hasOutdoor = resolved.sources.outdoor != null;

  const style = useMemo(
    () =>
      buildStyle({ styleId, sources: resolved.sources, glyphs: glyphsUrl(), lang, textScale, hillshade: overlays.hillshade }),
    [styleId, resolved, lang, textScale, overlays.hillshade],
  );

  const palette = PALETTES[styleId];
  const layers = useMemo(() => {
    const out: OverlayLayer[] = [];
    if (overlays.contours && hasOutdoor) out.push(...contourLayers(palette, textScale));
    if (overlays.buildings3d) out.push(buildings3dLayer(palette));
    if (overlays.tracks) out.push(...(hasOutdoor ? trackLayers(palette) : trackFallbackLayers(palette)));
    if (overlays.access) out.push(...(hasOutdoor ? accessLayers() : [accessFallbackLayer()]));
    if (hasOutdoor) out.push(maxspeedQueryLayer());
    if (overlays.poi) out.push(...poiLayers(palette, poiCategories, lang, textScale));
    return out;
  }, [overlays, hasOutdoor, palette, poiCategories, lang, textScale]);

  useEffect(() => {
    useUi.setState({ source: { region: resolved.region?.name ?? null, outdoor: hasOutdoor } });
  }, [resolved, hasOutdoor]);

  useEffect(() => {
    const r = regionAt(downloaded, useUi.getState().center);
    setRegionId(r?.id ?? null);
  }, [downloaded]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRegionDidChange = useCallback(
    (e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const { center, zoom, bearing, pitch } = e.nativeEvent;
      useUi.getState().setView({ center: [center[0], center[1]], zoom, bearing, pitch });
      if (zoom >= 5) {
        const r = regionAt(useOffline.getState().downloaded, [center[0], center[1]]);
        setRegionId((prev) => ((r?.id ?? null) === prev ? prev : (r?.id ?? null)));
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(
        () => useSettings.getState().set("lastCamera", { center: [center[0], center[1]], zoom }),
        2000,
      );
    },
    [],
  );

  const onPress = useCallback(
    async (e: NativeSyntheticEvent<PressEvent>) => {
      const { point } = e.nativeEvent;
      const r = 16;
      const box: PixelPointBounds = [
        [point[0] - r, point[1] - r],
        [point[0] + r, point[1] + r],
      ];
      const feats = (await mapRef.current?.queryRenderedFeatures(box, { layers: TAPPABLE }).catch(() => [])) ?? [];
      const alt = feats.find((f) => f.properties?.idx != null && f.properties?.sel === false);
      if (alt) {
        useRouting.getState().select(Number(alt.properties!.idx));
        return;
      }
      for (const f of feats) {
        const place = featureToPlace(f, lang);
        if (place) {
          useUi.getState().showPlace(place);
          return;
        }
      }
      const ui = useUi.getState();
      if (ui.panel === "place") ui.clearPlace();
    },
    [lang],
  );

  const onLongPress = useCallback((e: NativeSyntheticEvent<PressEvent>) => {
    const [lon, lat] = e.nativeEvent.lngLat;
    useUi.getState().showPlace({ id: uid("pin"), name: t("map.droppedPin"), lon, lat }, { pin: true });
  }, []);

  const onTrackChange = useCallback((e: NativeSyntheticEvent<{ trackUserLocation: TrackUserLocation | null }>) => {
    if (e.nativeEvent.trackUserLocation == null && useUi.getState().follow !== "off") {
      useUi.getState().setFollow("off");
    }
  }, []);

  const contentInset = useMemo(() => (navActive ? { top: Math.round(height * 0.38) } : undefined), [navActive, height]);

  return (
    <Map
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      mapStyle={style}
      onPress={onPress}
      onLongPress={onLongPress}
      onRegionDidChange={onRegionDidChange}
      logo={false}
      attribution
      attributionPosition={{ bottom: 6, left: 8 }}
      compass={false}
      tintColor={colors.textDim}
      contentInset={contentInset}
      preferredFramesPerSecond={60}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: initial.center, zoom: initial.zoom }}
        minZoom={2}
        maxZoom={19.5}
        trackUserLocation={TRACKING[follow]}
        onTrackUserLocationChange={onTrackChange}
      />
      <Images images={MAP_ICONS} />
      <OverlayLayers layers={layers} />
      <TrackLayers />
      <RouteLayers />
      <PinLayers />
      <NativeUserLocation mode={follow === "course" || navActive ? "course" : "heading"} />
    </Map>
  );
});
