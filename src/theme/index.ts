import { Platform, type TextStyle } from "react-native";

export const colors = {
  bg: "#0B0E13",
  surface: "#141920",
  surface2: "#1C232D",
  surface3: "#26303C",
  border: "#2C3643",
  text: "#F3F6FA",
  textDim: "#9AA7B6",
  textMuted: "#66727F",
  accent: "#E4002B",
  accentSoft: "#E4002B26",
  go: "#1FCB6B",
  goPressed: "#17A457",
  stop: "#FF3B4E",
  route: "#3D8BFF",
  routeCasing: "#0A3A8C",
  routeAlt: "#7A8796",
  warn: "#FFB020",
  info: "#2BD4F0",
  record: "#FF2D55",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(5,7,10,0.55)",
} as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 8 },
});

const family = Platform.select({ ios: "System", default: undefined });

export const type = {
  hero: { fontFamily: family, fontSize: 64, fontWeight: "800", letterSpacing: -2, color: colors.text },
  h1: { fontFamily: family, fontSize: 26, fontWeight: "800", color: colors.text },
  h2: { fontFamily: family, fontSize: 20, fontWeight: "700", color: colors.text },
  h3: { fontFamily: family, fontSize: 17, fontWeight: "700", color: colors.text },
  body: { fontFamily: family, fontSize: 15, fontWeight: "500", color: colors.text },
  small: { fontFamily: family, fontSize: 13, fontWeight: "500", color: colors.textDim },
  tiny: { fontFamily: family, fontSize: 11, fontWeight: "600", color: colors.textDim },
  mono: { fontFamily: family, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"], color: colors.text },
} satisfies Record<string, TextStyle>;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
