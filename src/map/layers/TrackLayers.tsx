import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { memo, useMemo } from "react";

import { useRecording } from "@/recording/store";
import { useTracks } from "@/store/tracks";
import { colors } from "@/theme";

const LABELS = "label-waterway";
const WIDTH = ["interpolate", ["exponential", 1.5], ["zoom"], 8, 3, 13, 4.5, 17, 9] as const;
const CASING = ["interpolate", ["exponential", 1.5], ["zoom"], 8, 5.5, 13, 7, 17, 12] as const;

const RecordingTrack = memo(function RecordingTrack() {
  const track = useRecording((s) => s.track);
  const data = useMemo<GeoJSON.Feature | null>(
    () =>
      track.length >= 2
        ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: track } }
        : null,
    [track],
  );
  if (!data) return null;
  return (
    <GeoJSONSource id="rec-track" data={data}>
      <Layer
        id="rec-track-casing"
        type="line"
        beforeId={LABELS}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{ "line-color": "#3A0010", "line-width": CASING as never }}
      />
      <Layer
        id="rec-track-line"
        type="line"
        beforeId={LABELS}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{ "line-color": colors.record, "line-width": WIDTH as never }}
      />
    </GeoJSONSource>
  );
});

const ViewTrack = memo(function ViewTrack() {
  const track = useTracks((s) => s.track);
  const data = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!track || track.coords.length < 2) return null;
    const coords = track.coords.map((c) => [c[0], c[1]]);
    const features: GeoJSON.Feature[] = [
      { type: "Feature", properties: { kind: "line" }, geometry: { type: "LineString", coordinates: coords } },
      { type: "Feature", properties: { kind: "pt", icon: "ride-start" }, geometry: { type: "Point", coordinates: coords[0] } },
      {
        type: "Feature",
        properties: { kind: "pt", icon: "ride-end" },
        geometry: { type: "Point", coordinates: coords[coords.length - 1] },
      },
      ...(track.waypoints ?? []).map<GeoJSON.Feature>((w) => ({
        type: "Feature",
        properties: { kind: "pt", icon: w.photo ? "pin-photo" : "pin-waypoint", name: w.name },
        geometry: { type: "Point", coordinates: [w.lon, w.lat] },
      })),
    ];
    return { type: "FeatureCollection", features };
  }, [track]);
  if (!data) return null;
  return (
    <GeoJSONSource id="view-track" data={data}>
      <Layer
        id="view-track-casing"
        type="line"
        beforeId={LABELS}
        filter={["==", ["get", "kind"], "line"]}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{ "line-color": "#062B33", "line-width": CASING as never }}
      />
      <Layer
        id="view-track-line"
        type="line"
        beforeId={LABELS}
        filter={["==", ["get", "kind"], "line"]}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{ "line-color": colors.info, "line-width": WIDTH as never }}
      />
      <Layer
        id="view-track-points"
        type="symbol"
        filter={["==", ["get", "kind"], "pt"]}
        layout={{
          "icon-image": ["get", "icon"] as never,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "text-field": ["coalesce", ["get", "name"], ""] as never,
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-anchor": "top",
          "text-offset": [0, 0.3],
          "text-optional": true,
        }}
        paint={{ "text-color": "#E6F7FB", "text-halo-color": "#0B0E13", "text-halo-width": 1.4 }}
      />
    </GeoJSONSource>
  );
});

export function TrackLayers() {
  return (
    <>
      <ViewTrack />
      <RecordingTrack />
    </>
  );
}
