import * as Speech from "expo-speech";

import { speechLocale, t } from "@/i18n";
import { useSettings } from "@/store/settings";
import type { Maneuver } from "@/types";
import { spokenDistance } from "@/utils/format";

import { useNav } from "./store";

export function speak(text: string, opts: { interrupt?: boolean } = {}) {
  if (!useSettings.getState().voice || useNav.getState().muted) return;
  if (opts.interrupt) Speech.stop();
  Speech.speak(text, { language: speechLocale(), rate: 1.0, pitch: 1.0 });
}

export function stopSpeech() {
  Speech.stop();
}

export function maneuverText(m: Maneuver): string {
  if (m.type === "roundabout") return m.exit ? t("nav.maneuver.roundabout", { n: m.exit }) : t("nav.maneuver.roundaboutAny");
  return t(`nav.maneuver.${m.type}`);
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function announceText(m: Maneuver, distance: number | null, then?: Maneuver | null): string {
  let action = maneuverText(m);
  if (then) action = `${action}, ${lower(t("nav.then"))} ${lower(maneuverText(then))}`;
  if (distance == null) return action;
  return t("nav.voice.inDistance", { distance: spokenDistance(distance), action: lower(action) });
}
