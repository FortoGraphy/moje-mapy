import { currentLang } from "@/i18n";
import { useSettings, type Units } from "@/store/settings";

const MI = 1609.344;

function units(): Units {
  return useSettings.getState().units;
}

export function fmtDistance(m: number, u: Units = units()): string {
  const dec = currentLang() === "cs" ? "," : ".";
  if (u === "imperial") {
    const mi = m / MI;
    if (mi < 0.1) return `${Math.round(m * 3.28084 / 10) * 10} ft`;
    return `${mi < 10 ? mi.toFixed(1).replace(".", dec) : Math.round(mi)} mi`;
  }
  if (m < 1000) return `${m < 100 ? Math.round(m / 5) * 5 : Math.round(m / 10) * 10} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1).replace(".", dec) : Math.round(km)} km`;
}

/** Spoken distance, rounded to what a rider can use. */
export function spokenDistance(m: number, u: Units = units()): string {
  const cs = currentLang() === "cs";
  if (u === "imperial") {
    const mi = m / MI;
    if (mi >= 0.5) return `${mi.toFixed(1)} ${cs ? "míle" : "miles"}`;
    return `${Math.round((m * 3.28084) / 100) * 100} ${cs ? "stop" : "feet"}`;
  }
  if (m >= 1000) {
    const km = Math.round(m / 100) / 10;
    return cs ? `${String(km).replace(".", ",")} kilometru` : `${km} kilometers`;
  }
  const r = m >= 200 ? Math.round(m / 100) * 100 : Math.round(m / 10) * 10;
  return cs ? `${r} metrů` : `${r} meters`;
}

export function speedValue(ms: number | null | undefined, u: Units = units()): number {
  if (ms == null || ms < 0) return 0;
  return u === "imperial" ? ms * 2.236936 : ms * 3.6;
}

export function fmtSpeed(ms: number | null | undefined, u: Units = units()): string {
  return `${Math.round(speedValue(ms, u))} ${u === "imperial" ? "mph" : "km/h"}`;
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${m.toString().padStart(2, "0")} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

export function fmtClockDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`
    : `${m}:${ss.toString().padStart(2, "0")}`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(currentLang() === "cs" ? "cs-CZ" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtElevation(m: number | null | undefined, u: Units = units()): string {
  if (m == null) return "–";
  return u === "imperial" ? `${Math.round(m * 3.28084)} ft` : `${Math.round(m)} m`;
}

export function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} kB`;
  if (b < 1024 * 1024 * 1024) return `${Math.round(b / (1024 * 1024))} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function compassDir(deg: number | null | undefined): string {
  if (deg == null) return "–";
  const dirs =
    currentLang() === "cs"
      ? ["S", "SV", "V", "JV", "J", "JZ", "Z", "SZ"]
      : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Speed limit (stored in km/h) in display units. */
export function limitValue(kmh: number, u: Units = units()): number {
  return u === "imperial" ? Math.round(kmh / 1.609) : kmh;
}

export function fmtCoords(lon: number, lat: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export function uid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
