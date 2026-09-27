import type { CameraRef, MapRef, ViewPadding } from "@maplibre/maplibre-react-native";
import { createRef } from "react";

import { useUi } from "@/store/ui";
import type { LngLat } from "@/types";

export const mapRef = createRef<MapRef>();
export const cameraRef = createRef<CameraRef>();

/** Bottom inset of the currently visible sheet, so fitted content is not hidden underneath. */
let sheetInset = 0;
export function setSheetInset(px: number) {
  sheetInset = px;
}

export function flyTo(center: LngLat, zoom?: number, duration = 900) {
  useUi.getState().setFollow("off");
  cameraRef.current?.flyTo({ center, zoom: zoom ?? Math.max(useUi.getState().zoom, 14), duration });
}

export function easeTo(center: LngLat, zoom?: number, duration = 500) {
  useUi.getState().setFollow("off");
  cameraRef.current?.easeTo({ center, zoom, duration });
}

export function fitBounds(bbox: [number, number, number, number], padding?: ViewPadding, duration = 900) {
  useUi.getState().setFollow("off");
  const [w, s, e, n] = bbox;
  if (e - w < 1e-5 && n - s < 1e-5) {
    flyTo([w, s], 15, duration);
    return;
  }
  cameraRef.current?.fitBounds(bbox, {
    padding: padding ?? { top: 140, left: 50, right: 50, bottom: sheetInset + 40 },
    duration,
  });
}

export function resetNorth() {
  cameraRef.current?.easeTo({ center: useUi.getState().center, bearing: 0, pitch: 0, duration: 400 });
}
