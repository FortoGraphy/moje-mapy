import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { TRACK_COLORS } from "@/map/style/palette";
import { colors, radius, space, type } from "@/theme";
import type { SurfaceClass } from "@/types";

/** Downsamples (x, y) series to at most `n` points, keeping min and max per bucket so peaks survive. */
function downsample(xs: number[], ys: number[], n: number): [number, number][] {
  if (xs.length <= n) return xs.map((x, i) => [x, ys[i]]);
  const out: [number, number][] = [];
  const size = xs.length / (n / 2);
  for (let b = 0; b < n / 2; b++) {
    const s = Math.floor(b * size);
    const e = Math.min(xs.length, Math.floor((b + 1) * size));
    let lo = s, hi = s;
    for (let i = s; i < e; i++) {
      if (ys[i] < ys[lo]) lo = i;
      if (ys[i] > ys[hi]) hi = i;
    }
    const [a, c] = lo < hi ? [lo, hi] : [hi, lo];
    out.push([xs[a], ys[a]]);
    if (c !== a) out.push([xs[c], ys[c]]);
  }
  return out;
}

export function AreaChart({
  xs,
  ys,
  height = 110,
  color = colors.route,
  fmtY,
  fmtX,
  marker,
}: {
  xs: number[];
  ys: number[];
  height?: number;
  color?: string;
  fmtY: (v: number) => string;
  fmtX?: (v: number) => string;
  /** x value to highlight with a vertical line */
  marker?: number | null;
}) {
  const [width, setWidth] = useState(0);
  const pts = useMemo(() => downsample(xs, ys, 240), [xs, ys]);
  const { minY, maxY, maxX } = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const [, y] of pts) {
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    if (!Number.isFinite(lo)) lo = hi = 0;
    const pad = Math.max(5, (hi - lo) * 0.1);
    return { minY: lo - pad, maxY: hi + pad, maxX: pts.length ? pts[pts.length - 1][0] : 1 };
  }, [pts]);

  const top = 6;
  const h = height - top;
  const sx = (x: number) => (maxX > 0 ? (x / maxX) * width : 0);
  const sy = (y: number) => top + h - ((y - minY) / (maxY - minY || 1)) * h;
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join("");
  const area = pts.length ? `${line}L${width},${height}L0,${height}Z` : "";
  const gid = `g${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && pts.length > 1 && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.45} />
                <Stop offset="1" stopColor={color} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <Line key={f} x1={0} x2={width} y1={top + h * f} y2={top + h * f} stroke={colors.border} strokeWidth={0.5} />
            ))}
            <Path d={area} fill={`url(#${gid})`} />
            <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {marker != null && (
              <Line x1={sx(marker)} x2={sx(marker)} y1={0} y2={height} stroke={colors.white} strokeWidth={1.5} />
            )}
          </Svg>
        )}
        <Text style={[styles.axis, { top: 0 }]}>{fmtY(maxY)}</Text>
        <Text style={[styles.axis, { bottom: 2 }]}>{fmtY(minY)}</Text>
      </View>
      {fmtX && (
        <View style={styles.xAxis}>
          <Text style={type.tiny}>{fmtX(0)}</Text>
          <Text style={type.tiny}>{fmtX(maxX / 2)}</Text>
          <Text style={type.tiny}>{fmtX(maxX)}</Text>
        </View>
      )}
    </View>
  );
}

export const SURFACE_COLORS: Record<SurfaceClass, string> = {
  paved: "#5E6B7A",
  gravel: "#C8A96B",
  grade1: TRACK_COLORS.grade1,
  grade2: TRACK_COLORS.grade2,
  grade3: TRACK_COLORS.grade3,
  grade4: TRACK_COLORS.grade4,
  grade5: TRACK_COLORS.grade5,
  path: TRACK_COLORS.path,
  unknown: TRACK_COLORS.unknown,
};

const ORDER: SurfaceClass[] = ["paved", "grade1", "gravel", "grade2", "grade3", "grade4", "grade5", "unknown", "path"];

/** Horizontal bar of route surfaces in route order, plus a legend with total lengths. */
export function SurfaceBar({
  parts,
  label,
  fmt,
}: {
  parts: { surface: SurfaceClass; length: number }[];
  label: (s: SurfaceClass) => string;
  fmt: (m: number) => string;
}) {
  const [width, setWidth] = useState(0);
  const total = parts.reduce((s, p) => s + p.length, 0) || 1;
  const totals = useMemo(() => {
    const m = new Map<SurfaceClass, number>();
    for (const p of parts) m.set(p.surface, (m.get(p.surface) ?? 0) + p.length);
    return ORDER.filter((s) => (m.get(s) ?? 0) > 0).map((s) => ({ surface: s, length: m.get(s)! }));
  }, [parts]);

  let x = 0;
  return (
    <View>
      <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={12}>
            {parts.map((p, i) => {
              const w = (p.length / total) * width;
              const r = <Rect key={i} x={x} y={0} width={w + 0.5} height={12} fill={SURFACE_COLORS[p.surface]} />;
              x += w;
              return r;
            })}
          </Svg>
        )}
      </View>
      <View style={styles.legend}>
        {totals.map((s) => (
          <View key={s.surface} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: SURFACE_COLORS[s.surface] }]} />
            <Text style={type.tiny}>
              {label(s.surface)} <Text style={{ color: colors.text }}>{fmt(s.length)}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { ...type.tiny, position: "absolute", left: 4, fontSize: 10 },
  xAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  bar: { height: 12, borderRadius: radius.pill, overflow: "hidden", backgroundColor: colors.surface3 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
