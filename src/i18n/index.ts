import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";

import cs from "./cs";
import en from "./en";

export type Lang = "cs" | "en";
export type LangSetting = Lang | "system";

export function systemLang(): Lang {
  const code = getLocales()[0]?.languageCode;
  return code === "cs" || code === "sk" ? "cs" : "en";
}

export function resolveLang(setting: LangSetting): Lang {
  return setting === "system" ? systemLang() : setting;
}

i18n.use(initReactI18next).init({
  resources: { cs: { translation: cs }, en: { translation: en } },
  lng: systemLang(),
  fallbackLng: "cs",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function applyLanguage(setting: LangSetting) {
  const lang = resolveLang(setting);
  if (i18n.language !== lang) i18n.changeLanguage(lang);
}

export function currentLang(): Lang {
  return i18n.language === "en" ? "en" : "cs";
}

export function speechLocale(): string {
  return currentLang() === "cs" ? "cs-CZ" : "en-US";
}

export const t = i18n.t.bind(i18n);
export const useT = () => useTranslation().t;
export const useLang = (): Lang => (useTranslation().i18n.language === "en" ? "en" : "cs");
export default i18n;
