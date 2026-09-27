import type { MapStyleId } from "@/store/settings";

export interface Palette {
  dark: boolean;
  background: string;
  wood: string;
  grass: string;
  farmland: string;
  wetland: string;
  sand: string;
  ice: string;
  residential: string;
  industrial: string;
  cemetery: string;
  park: string;
  water: string;
  waterway: string;
  building: string;
  buildingOutline: string;
  casing: string;
  motorway: string;
  trunk: string;
  primary: string;
  secondary: string;
  tertiary: string;
  minor: string;
  service: string;
  track: string;
  path: string;
  rail: string;
  boundary: string;
  text: string;
  textDim: string;
  halo: string;
  waterText: string;
  roadText: string;
  hillshadeShadow: string;
  hillshadeHighlight: string;
  hillshadeAccent: string;
  hillshadeExaggeration: number;
  contour: string;
  contourText: string;
  trackCasing: string;
  peakText: string;
}

const enduro: Palette = {
  dark: true,
  background: "#12161C",
  wood: "#16261B",
  grass: "#18231A",
  farmland: "#161B17",
  wetland: "#14222A",
  sand: "#2A2619",
  ice: "#26303A",
  residential: "#1A1E25",
  industrial: "#1E1D24",
  cemetery: "#1A241C",
  park: "#172A1D",
  water: "#0C2233",
  waterway: "#15415E",
  building: "#232A33",
  buildingOutline: "#2D3641",
  casing: "#07090C",
  motorway: "#D97A2B",
  trunk: "#C9922E",
  primary: "#B69B3A",
  secondary: "#8D8A52",
  tertiary: "#6B7380",
  minor: "#4B5563",
  service: "#3A424D",
  track: "#9C7A4E",
  path: "#8A7B66",
  rail: "#5B6470",
  boundary: "#8F6BB3",
  text: "#DCE3EC",
  textDim: "#98A3B1",
  halo: "#0B0E13",
  waterText: "#6FA8D6",
  roadText: "#C3CCD7",
  hillshadeShadow: "rgba(0,0,0,0.85)",
  hillshadeHighlight: "rgba(255,255,255,0.22)",
  hillshadeAccent: "rgba(0,0,0,0.45)",
  hillshadeExaggeration: 0.5,
  contour: "#8A7456",
  contourText: "#B39B78",
  trackCasing: "#07090C",
  peakText: "#E8C99A",
};

const road: Palette = {
  ...enduro,
  background: "#161A21",
  wood: "#18221C",
  grass: "#192219",
  farmland: "#171B18",
  park: "#18251C",
  residential: "#1C2028",
  motorway: "#F28C28",
  trunk: "#F2B233",
  primary: "#E6C64A",
  secondary: "#C8C47A",
  tertiary: "#9AA3AE",
  minor: "#6B7482",
  service: "#4A525E",
  track: "#6E5A3F",
  path: "#5E554A",
  hillshadeExaggeration: 0.25,
  contour: "#5E5242",
};

const topo: Palette = {
  dark: false,
  background: "#F3F0E8",
  wood: "#C6DDB3",
  grass: "#D9E9C5",
  farmland: "#EEF0DA",
  wetland: "#D2E6E6",
  sand: "#F2E4BE",
  ice: "#F4F8FB",
  residential: "#EAE4DC",
  industrial: "#E6DDE3",
  cemetery: "#D5E3CC",
  park: "#CDE6BF",
  water: "#A6CDEB",
  waterway: "#7FB4DE",
  building: "#DCD3C8",
  buildingOutline: "#C9BEB1",
  casing: "#A69E93",
  motorway: "#F39A4B",
  trunk: "#F7B955",
  primary: "#FCD983",
  secondary: "#FBEFA3",
  tertiary: "#FFFFFF",
  minor: "#FFFFFF",
  service: "#FFFFFF",
  track: "#8B5E34",
  path: "#9A6B4A",
  rail: "#9A9A9A",
  boundary: "#9B6FB8",
  text: "#2B2F36",
  textDim: "#5C6570",
  halo: "#FFFFFF",
  waterText: "#2F6FA3",
  roadText: "#3A3F47",
  hillshadeShadow: "#473B24",
  hillshadeHighlight: "#FFFFFF",
  hillshadeAccent: "#6B5A3A",
  hillshadeExaggeration: 0.5,
  contour: "#B8875A",
  contourText: "#8E6039",
  trackCasing: "#FFFFFF",
  peakText: "#6B4423",
};

export const PALETTES: Record<MapStyleId, Palette> = { enduro, road, topo };

export const TRACK_COLORS = {
  grade1: "#3DDC84",
  grade2: "#B6E34A",
  grade3: "#FFD23F",
  grade4: "#FF8C2E",
  grade5: "#D2452C",
  unknown: "#A7B1BD",
  path: "#D9C7AE",
  restricted: "#FF2D2D",
} as const;
