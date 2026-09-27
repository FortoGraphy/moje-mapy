import Svg, { Circle, Path, Rect } from "react-native-svg";

import { PALETTES, TRACK_COLORS } from "@/map/style/palette";
import type { MapStyleId } from "@/store/settings";

/** Tiny illustrative thumbnail of a map style drawn from its palette. */
export function StylePreview({ id, width = 96, height = 64 }: { id: MapStyleId; width?: number; height?: number }) {
  const p = PALETTES[id];
  return (
    <Svg width={width} height={height} viewBox="0 0 96 64">
      <Rect width="96" height="64" fill={p.background} />
      <Path d="M0 0 H40 C34 14 44 24 30 36 C20 44 8 40 0 46 Z" fill={p.wood} />
      <Path d="M62 64 C60 52 72 44 84 46 C90 47 94 42 96 38 V64 Z" fill={p.water} />
      <Path d="M58 0 C56 10 66 16 64 26 C62 36 70 40 68 48" stroke={p.waterway} strokeWidth={2} fill="none" />
      <Path d="M0 54 C24 50 40 40 56 30 C70 22 84 18 96 16" stroke={p.casing} strokeWidth={6} fill="none" />
      <Path d="M0 54 C24 50 40 40 56 30 C70 22 84 18 96 16" stroke={p.primary} strokeWidth={4} fill="none" />
      <Path d="M28 44 C30 30 22 20 26 6" stroke={p.trackCasing} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      <Path
        d="M28 44 C30 30 22 20 26 6"
        stroke={id === "road" ? p.track : TRACK_COLORS.grade3}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M44 36 C50 44 48 54 56 62"
        stroke={id === "road" ? p.track : TRACK_COLORS.grade1}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx="78" cy="30" r="3" fill="#FF8A00" stroke={p.halo} strokeWidth={1.2} />
    </Svg>
  );
}
