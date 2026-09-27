export type LngLat = [number, number];

export interface Fix {
  lon: number;
  lat: number;
  alt: number | null;
  /** m/s, null when unknown */
  speed: number | null;
  /** degrees 0-360 direction of travel */
  course: number | null;
  accuracy: number | null;
  altAccuracy: number | null;
  ts: number;
}

export interface Place {
  id: string;
  name: string;
  subtitle?: string;
  lon: number;
  lat: number;
  category?: string;
  osmType?: "N" | "W" | "R";
  osmId?: number;
  tags?: Record<string, string>;
}

export type ProfileId = "enduro" | "moto_road" | "moto_curvy" | "hike" | "bike";

export type SurfaceClass =
  | "paved"
  | "gravel"
  | "grade1"
  | "grade2"
  | "grade3"
  | "grade4"
  | "grade5"
  | "path"
  | "unknown";

export type ManeuverType =
  | "depart"
  | "straight"
  | "slightLeft"
  | "left"
  | "sharpLeft"
  | "slightRight"
  | "right"
  | "sharpRight"
  | "keepLeft"
  | "keepRight"
  | "uturn"
  | "roundabout"
  | "arrive"
  | "offRoute";

export interface Maneuver {
  type: ManeuverType;
  /** index into route coordinates */
  index: number;
  /** cumulative distance from route start in meters */
  at: number;
  exit?: number;
  streetName?: string;
}

export interface RouteSegment {
  from: number;
  to: number;
  surface: SurfaceClass;
  highway?: string;
  maxspeed?: number;
}

export interface Route {
  id: string;
  profile: ProfileId;
  /** [lon, lat, ele] */
  coords: [number, number, number][];
  /** cumulative distance per coordinate in meters */
  cumDist: number[];
  distance: number;
  /** seconds */
  duration: number;
  ascent: number;
  descent: number;
  segments: RouteSegment[];
  maneuvers: Maneuver[];
  /** indexes into coords where each via point / stop is reached */
  legEnds: number[];
  bbox: [number, number, number, number];
}

export interface RoutePoint {
  key: string;
  place: Place | null;
  /** true = live GPS position */
  isMyLocation?: boolean;
}
