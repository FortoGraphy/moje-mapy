import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { memo, useMemo } from "react";

import { useNav } from "@/navigation/store";
import { resolvePoint, useRouting } from "@/routing/store";
import { colors } from "@/theme";
import type { Route } from "@/types";

const LABELS = "label-waterway";
const WIDTH = ["interpolate", ["exponential", 1.5], ["zoom"], 8, 4, 13, 6, 17, 12] as const;
const CASING = ["interpolate", ["exponential", 1.5], ["zoom"], 8, 6.5, 13, 9.5, 17, 17] as const;

function line(route: Route, props: Record<string, unknown>): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: props,
    geometry: { type: "LineString", coordinates: route.coords.map((c) => [c[0], c[1]]) },
  };
}

const PlannerRoutes = memo(function PlannerRoutes() {
  const routes = useRouting((s) => s.routes);
  const selected = useRouting((s) => s.selected);
  const data = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: routes.map((r, i) => line(r, { idx: i, sel: i === selected })),
    }),
    [routes, selected],
  );
  if (!routes.length) return null;
  return (
    <GeoJSONSource id="planner-routes" data={data}>
      <Layer
        id="route-alt-casing"
        type="line"
        beforeId={LABELS}
        filter={["!", ["get", "sel"]]}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{ "line-color": "#27313D", "line-width": CASING as never }}
      />
      <Layer
        id="route-alt"
        type="line"
        beforeId={LABELS}
        filter={["!", ["get", "sel"]]}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{ "line-color": colors.routeAlt, "line-width": WIDTH as never }}
      />
      <Layer
        id="route-casing"
        type="line"
        beforeId={LABELS}
        filter={["get", "sel"]}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{ "line-color": colors.routeCasing, "line-width": CASING as never }}
      />
      <Layer
        id="route-line"
        type="line"
        beforeId={LABELS}
        filter={["get", "sel"]}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{ "line-color": colors.route, "line-width": WIDTH as never }}
      />
      <Layer
        id="route-arrows"
        type="symbol"
        filter={["get", "sel"]}
        minzoom={12}
        layout={{
          "symbol-placement": "line",
          "symbol-spacing": 90,
          "icon-image": "route-arrow",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.45, 17, 0.8] as never,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-rotation-alignment": "map",
        }}
      />
    </GeoJSONSource>
  );
});

const NavRoute = memo(function NavRoute() {
  const route = useNav((s) => s.route);
  const along = useNav((s) => s.progress?.along ?? 0);
  const data = useMemo(() => (route ? line(route, {}) : null), [route]);
  if (!route || !data) return null;
  // Round to 0.1 % so the gradient is not re-sent to the native side on every fix.
  const frac = Math.min(0.999, Math.max(0.0001, Math.round((along / Math.max(1, route.distance)) * 1000) / 1000));
  return (
    <GeoJSONSource id="nav-route" data={data} lineMetrics>
      <Layer
        id="nav-casing"
        type="line"
        beforeId={LABELS}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{ "line-color": colors.routeCasing, "line-width": CASING as never }}
      />
      <Layer
        id="nav-line"
        type="line"
        beforeId={LABELS}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{
          "line-width": WIDTH as never,
          "line-gradient": ["step", ["line-progress"], "#5B6675", frac, colors.route] as never,
        }}
      />
      <Layer
        id="nav-arrows"
        type="symbol"
        minzoom={13}
        layout={{
          "symbol-placement": "line",
          "symbol-spacing": 110,
          "icon-image": "route-arrow",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.5, 18, 0.85] as never,
          "icon-allow-overlap": true,
          "icon-rotation-alignment": "map",
        }}
      />
    </GeoJSONSource>
  );
});

const StopPins = memo(function StopPins() {
  const points = useRouting((s) => s.points);
  const navActive = useNav((s) => s.active);
  const navRoute = useNav((s) => s.route);
  const data = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    const n = points.length;
    points.forEach((p, i) => {
      if (p.isMyLocation) return;
      const c = resolvePoint(p);
      if (!c) return;
      const icon = i === 0 ? "pin-start" : i === n - 1 ? "pin-end" : "pin-stop";
      features.push({
        type: "Feature",
        properties: { icon, label: i > 0 && i < n - 1 ? String(i) : "" },
        geometry: { type: "Point", coordinates: c },
      });
    });
    return { type: "FeatureCollection", features };
  }, [points]);
  if (!data.features.length || (navActive && navRoute == null)) return null;
  return (
    <GeoJSONSource id="route-stops-src" data={data}>
      <Layer
        id="route-stops"
        type="symbol"
        layout={{
          "icon-image": ["get", "icon"] as never,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "text-field": ["get", "label"] as never,
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
          "text-offset": [0, -2.05],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        }}
        paint={{ "text-color": "#FFFFFF" }}
      />
    </GeoJSONSource>
  );
});

export function RouteLayers() {
  const navActive = useNav((s) => s.active);
  return (
    <>
      {navActive ? <NavRoute /> : <PlannerRoutes />}
      <StopPins />
    </>
  );
}
