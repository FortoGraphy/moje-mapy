import { Layer } from "@maplibre/maplibre-react-native";
import { memo, useEffect, useState } from "react";

import { useSettings } from "@/store/settings";

import { HILLSHADE_IDS } from "../style/buildStyle";

const SWAP_EVERY = 3000;
let moved = false;

/** Called whenever the camera settles; new DEM tiles may have been prepared since the last swap. */
export function noteCameraMoved() {
  moved = true;
}

/**
 * Takes over the two hillshade layers from the style JSON and only toggles their visibility
 * (hillshade paint setters crash MapLibre RN on iOS). Hiding the active layer makes MapLibre drop the
 * per-tile render targets it would otherwise keep re-rendering every frame; the other layer reuses
 * the already prepared tile textures, so the swap is invisible.
 * Must stay mounted while the map exists: unmounting removes the adopted layer from the style.
 */
export const HillshadeLayers = memo(function HillshadeLayers() {
  const enabled = useSettings((s) => s.overlays.hillshade);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (!moved) return;
      moved = false;
      setActive((a) => 1 - a);
    }, SWAP_EVERY);
    return () => clearInterval(timer);
  }, [enabled]);

  return (
    <>
      {HILLSHADE_IDS.map((id, i) => (
        <Layer
          key={id}
          id={id}
          type="hillshade"
          source="dem"
          layout={{ visibility: enabled && i === active ? "visible" : "none" }}
        />
      ))}
    </>
  );
});
