import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

import { FlagCheckered, NavigationArrow } from "@/components/icons";
import type { ManeuverType } from "@/types";

const ANGLES: Partial<Record<ManeuverType, number>> = {
  straight: 0,
  slightLeft: -40,
  left: -90,
  sharpLeft: -135,
  slightRight: 40,
  right: 90,
  sharpRight: 135,
  keepLeft: -30,
  keepRight: 30,
};

function arrow(angle: number): { stem: string; head: string } {
  const r = (angle * Math.PI) / 180;
  const dx = Math.sin(r);
  const dy = -Math.cos(r);
  const len = 13;
  const ex = 24 + dx * len;
  const ey = 24 + dy * len;
  const tipX = ex + dx * 7;
  const tipY = ey + dy * 7;
  const px = -dy, py = dx;
  const stem = `M24,44 L24,26 Q24,24 ${(24 + dx * 2).toFixed(2)},${(24 + dy * 2).toFixed(2)} L${ex.toFixed(2)},${ey.toFixed(2)}`;
  const head = `M${tipX.toFixed(2)},${tipY.toFixed(2)} L${(ex + px * 7).toFixed(2)},${(ey + py * 7).toFixed(2)} L${(ex - px * 7).toFixed(2)},${(ey - py * 7).toFixed(2)} Z`;
  return { stem, head };
}

export function ManeuverIcon({ type, exit, size = 56, color = "#FFFFFF" }: { type: ManeuverType; exit?: number; size?: number; color?: string }) {
  if (type === "arrive") return <FlagCheckered size={size * 0.8} color={color} weight="fill" />;
  if (type === "depart" || type === "offRoute") return <NavigationArrow size={size * 0.75} color={color} weight="fill" />;

  if (type === "uturn") {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path d="M32,44 L32,20 A8,8 0 0 0 16,20 L16,30" stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16,40 L9,29 L23,29 Z" fill={color} />
      </Svg>
    );
  }

  if (type === "roundabout") {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Circle cx={24} cy={22} r={9} stroke={color} strokeOpacity={0.45} strokeWidth={4} fill="none" />
        <Path d="M24,44 L24,31" stroke={color} strokeWidth={5} strokeLinecap="round" />
        <Path d="M30.4,15.6 L34.6,11.4" stroke={color} strokeWidth={5} strokeLinecap="round" />
        <Path d="M39.5,6.5 L39.5,16.3 L29.7,6.5 Z" fill={color} />
        {exit ? (
          <SvgText x={24} y={26} fontSize={11} fontWeight="800" fill={color} textAnchor="middle">
            {exit}
          </SvgText>
        ) : null}
      </Svg>
    );
  }

  const angle = ANGLES[type] ?? 0;
  const main = arrow(angle);
  const keep = type === "keepLeft" || type === "keepRight";
  const other = keep ? arrow(type === "keepLeft" ? 25 : -25) : null;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {other && <Path d={other.stem} stroke={color} strokeOpacity={0.35} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      <Path d={main.stem} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={main.head} fill={color} />
    </Svg>
  );
}
