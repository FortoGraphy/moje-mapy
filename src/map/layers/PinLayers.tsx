import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";

import { useUi } from "@/store/ui";

/** Marker for the place currently shown in the place card. */
export function PinLayers() {
  const place = useUi((s) => s.place);
  const dropped = useUi((s) => s.droppedPin);
  const data = useMemo<GeoJSON.Feature | null>(() => {
    if (dropped) {
      return { type: "Feature", properties: { icon: "pin-dropped" }, geometry: { type: "Point", coordinates: dropped } };
    }
    if (place) {
      return {
        type: "Feature",
        properties: { icon: "pin-search" },
        geometry: { type: "Point", coordinates: [place.lon, place.lat] },
      };
    }
    return null;
  }, [place, dropped]);
  if (!data) return null;
  return (
    <GeoJSONSource id="pin-src" data={data}>
      <Layer
        id="pin"
        type="symbol"
        layout={{
          "icon-image": ["get", "icon"] as never,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        }}
      />
    </GeoJSONSource>
  );
}
