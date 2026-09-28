import Constants from "expo-constants";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";

import {
  CloudArrowDown,
  Motorcycle,
  Path as PathIcon,
  SpeakerHigh,
  Speedometer,
} from "@/components/icons";
import { Card, Row, SectionTitle, Segmented, SwitchRow, Touch } from "@/components/ui";
import { CONFIG } from "@/config";
import { type LangSetting, speechLocale, useT } from "@/i18n";
import { useSettings } from "@/store/settings";
import { colors, radius, space, type } from "@/theme";
import { announceText } from "@/navigation/voice";

const TOLERANCES = [0, 5, 10, 15];

export default function SettingsScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const s = useSettings(useShallow(({ trips: _t, lastCamera: _c, ...rest }) => rest));
  const [brouter, setBrouter] = useState(s.brouterUrl);

  const commitBrouter = () => {
    const v = brouter.trim().replace(/\/$/, "");
    s.set("brouterUrl", v || CONFIG.brouterUrl);
    setBrouter(v || CONFIG.brouterUrl);
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <SectionTitle>{t("settings.general")}</SectionTitle>
      <Card style={styles.pad}>
        <Text style={styles.label}>{t("settings.language")}</Text>
        <Segmented<LangSetting>
          options={[
            { value: "system", label: t("settings.system") },
            { value: "cs", label: "Čeština" },
            { value: "en", label: "English" },
          ]}
          value={s.language}
          onChange={(v) => s.set("language", v)}
        />
        <Text style={[styles.label, { marginTop: space.md }]}>{t("settings.units")}</Text>
        <Segmented
          options={[
            { value: "metric", label: t("settings.metric") },
            { value: "imperial", label: t("settings.imperial") },
          ]}
          value={s.units}
          onChange={(v) => s.set("units", v)}
        />
      </Card>

      <SectionTitle>{t("settings.navigation")}</SectionTitle>
      <Card>
        <SwitchRow title={t("settings.voice")} value={s.voice} onChange={(v) => s.set("voice", v)} />
        <Row
          icon={<SpeakerHigh size={20} color={colors.textDim} weight="bold" />}
          title={t("settings.testVoice")}
          onPress={() => {
            Speech.stop();
            Speech.speak(announceText({ type: "right", index: 0, at: 0 }, 300), { language: speechLocale() });
          }}
        />
        <SwitchRow title={t("settings.speedAlert")} value={s.speedAlert} onChange={(v) => s.set("speedAlert", v)} />
        <View style={styles.inlinePad}>
          <Text style={styles.label}>
            {t("settings.speedTolerance")}: +{s.speedTolerance} {s.units === "imperial" ? "mph" : "km/h"}
          </Text>
          <Segmented
            options={TOLERANCES.map((v) => ({ value: String(v), label: `+${v}` }))}
            value={String(s.speedTolerance)}
            onChange={(v) => s.set("speedTolerance", Number(v))}
          />
        </View>
        <SwitchRow
          title={t("settings.respectAccess")}
          subtitle={t("settings.respectAccessHint")}
          value={s.respectAccess}
          onChange={(v) => s.set("respectAccess", v)}
          last
        />
      </Card>

      <SectionTitle>{t("settings.recording")}</SectionTitle>
      <Card>
        <SwitchRow title={t("settings.autoPause")} value={s.autoPause} onChange={(v) => s.set("autoPause", v)} />
        <SwitchRow title={t("settings.keepAwake")} value={s.keepAwake} onChange={(v) => s.set("keepAwake", v)} last />
      </Card>

      <SectionTitle>{t("settings.shortcuts")}</SectionTitle>
      <Card>
        <Row
          icon={<CloudArrowDown size={20} color={colors.info} weight="bold" />}
          title={t("settings.offlineMaps")}
          chevron
          onPress={() => router.push("/offline")}
        />
        <Row
          icon={<Motorcycle size={20} color={colors.record} weight="bold" />}
          title={t("settings.rides")}
          chevron
          onPress={() => router.push("/rides")}
        />
        <Row
          icon={<PathIcon size={20} color={colors.route} weight="bold" />}
          title={t("settings.routes")}
          chevron
          onPress={() => router.push("/routes")}
        />
        <Row
          icon={<Speedometer size={20} color={colors.go} weight="bold" />}
          title={t("settings.dashboard")}
          chevron
          onPress={() => router.push("/dashboard")}
          last
        />
      </Card>

      <SectionTitle>{t("settings.servers")}</SectionTitle>
      <Card style={styles.pad}>
        <Text style={styles.label}>{t("settings.brouter")}</Text>
        <TextInput
          value={brouter}
          onChangeText={setBrouter}
          onEndEditing={commitBrouter}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          keyboardAppearance="dark"
          style={styles.input}
          placeholder={CONFIG.brouterUrl}
          placeholderTextColor={colors.textMuted}
        />
        {brouter !== CONFIG.brouterUrl && (
          <Touch
            onPress={() => {
              setBrouter(CONFIG.brouterUrl);
              s.set("brouterUrl", CONFIG.brouterUrl);
            }}
          >
            <Text style={[type.small, { color: colors.route, marginTop: space.sm, fontWeight: "700" }]}>
              {t("settings.resetDefault")}
            </Text>
          </Touch>
        )}
        <Text style={[styles.label, { marginTop: space.lg }]}>{t("settings.dataServer")}</Text>
        <Text style={[type.body, { color: CONFIG.dataBaseUrl ? colors.text : colors.warn }]} selectable>
          {CONFIG.dataBaseUrl || t("settings.notSet")}
        </Text>
        <Text style={[type.tiny, { marginTop: 4 }]}>{t("settings.dataServerHint")}</Text>
      </Card>

      <SectionTitle>{t("settings.about")}</SectionTitle>
      <Card style={styles.pad}>
        <Text style={type.h3}>Moje Mapy</Text>
        <Text style={type.small}>
          {t("settings.version")} {Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
        <Text style={[type.small, { marginTop: space.md, lineHeight: 19 }]}>{t("settings.attribution")}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingVertical: space.lg },
  inlinePad: {
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { ...type.small, marginBottom: space.sm, fontWeight: "700" },
  input: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: 15,
  },
});
