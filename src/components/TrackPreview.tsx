import { useMemo } from "react";
import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "@/theme";

/** Small static drawing of a track (equirectangular), used in ride lists and details. */
export function TrackPreview({
  coords,
  width,
  height,
  color = colors.record,
  strokeWidth = 2.5,
}: {
  coords: number[][];
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
}) {
  const { d, start, end } = useMemo(() => {
    if (coords.length < 2) return { d: "", start: null, end: null };
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const c of coords) {
      if (c[0] < w) w = c[0];
      if (c[0] > e) e = c[0];
      if (c[1] < s) s = c[1];
      if (c[1] > n) n = c[1];
    }
    const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
    const pad = strokeWidth * 2 + 4;
    const spanX = Math.max((e - w) * k, 1e-9);
    const spanY = Math.max(n - s, 1e-9);
    const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
    const ox = (width - spanX * scale) / 2;
    const oy = (height - spanY * scale) / 2;
    const px = (c: number[]) => ox + (c[0] - w) * k * scale;
    const py = (c: number[]) => height - oy - (c[1] - s) * scale;
    const d = coords.map((c, i) => `${i ? "L" : "M"}${px(c).toFixed(1)},${py(c).toFixed(1)}`).join("");
    const last = coords[coords.length - 1];
    return { d, start: [px(coords[0]), py(coords[0])], end: [px(last), py(last)] };
  }, [coords, width, height, strokeWidth]);

  return (
    <Svg width={width} height={height}>
      {d ? <Path d={d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {start && <Circle cx={start[0]} cy={start[1]} r={strokeWidth + 1.5} fill={colors.go} />}
      {end && <Circle cx={end[0]} cy={end[1]} r={strokeWidth + 1.5} fill={colors.stop} />}
    </Svg>
  );
}
