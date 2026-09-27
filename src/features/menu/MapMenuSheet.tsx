import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";

import {
  Buildings,
  CloudArrowDown,
  Compass,
  Cube,
  MapPin,
  Mountains,
  Path as PathIcon,
  Signpost,
  Warning,
} from "@/components/icons";
import { Backdrop, sheetProps } from "@/components/sheet";
import { Card, Chip, Row, Segmented, SectionTitle, SwitchRow, Touch } from "@/components/ui";
import { useT } from "@/i18n";
import { POI_CATEGORIES, POI_CATEGORY_COLORS } from "@/map/poiCategories";
import { TRACK_COLORS } from "@/map/style/palette";
import { type MapStyleId, type OverlayId, useSettings } from "@/store/settings";
import { useUi } from "@/store/ui";
import { colors, radius, space, type } from "@/theme";

import { StylePreview } from "./StylePreview";

const STYLES: MapStyleId[] = ["enduro", "road", "topo"];
const OVERLAYS: { id: OverlayId; icon: (c: string) => React.ReactNode; needsOutdoor?: boolean }[] = [
  { id: "tracks", icon: (c) => <Signpost size={20} color={c} weight="bold" /> },
  { id: "access", icon: (c) => <Warning size={20} color={c} weight="bold" /> },
  { id: "hillshade", icon: (c) => <Mountains size={20} color={c} weight="bold" /> },
  { id: "contours", icon: (c) => <PathIcon size={20} color={c} weight="bold" />, needsOutdoor: true },
  { id: "poi", icon: (c) => <MapPin size={20} color={c} weight="bold" /> },
  { id: "buildings3d", icon: (c) => <Buildings size={20} color={c} weight="bold" /> },
];

type LegendKey = keyof typeof TRACK_COLORS;
const LEGEND: { key: LegendKey; dash?: string; width?: number }[] = [
  { key: "grade1" },
  { key: "grade2" },
  { key: "grade3" },
  { key: "grade4" },
  { key: "grade5" },
  { key: "unknown", dash: "7 4" },
  { key: "path", dash: "1.5 5", width: 2.5 },
  { key: "restricted", dash: "4 5" },
];

function LegendLine({ color, dash, width = 4 }: { color: string; dash?: string; width?: number }) {
  return (
    <Svg width={44} height={12}>
      <Line x1={2} y1={6} x2={42} y2={6} stroke="#07090C" strokeWidth={width + 3} strokeLinecap="round" />
      <Line x1={2} y1={6} x2={42} y2={6} stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
    </Svg>
  );
}

export function MapMenuSheet() {
  const t = useT();
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const open = useUi((s) => s.menuOpen);
  const source = useUi((s) => s.source);
  const s = useSettings();

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  const allPoi = POI_CATEGORIES.every((c) => s.poiCategories[c]);

  return (
    <BottomSheetModal
      ref={ref}
      {...sheetProps}
      snapPoints={["62%", "92%"]}
      enableDynamicSizing={false}
      backdropComponent={Backdrop}
      onDismiss={() => useUi.getState().setMenuOpen(false)}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 32 }}>
        <Text style={type.h2}>{t("map.menu")}</Text>

        <SectionTitle>{t("map.styles")}</SectionTitle>
        <View style={styles.styleRow}>
          {STYLES.map((id) => {
            const on = s.mapStyle === id;
            return (
              <Touch key={id} onPress={() => s.set("mapStyle", id)} style={[styles.styleCard, on ? styles.styleOn : {}]}>
                <View style={styles.preview}>
                  <StylePreview id={id} width={100} height={62} />
                </View>
                <Text style={[type.body, { fontWeight: "800", marginTop: 6 }]}>{t(`map.style.${id}`)}</Text>
                <Text style={[type.tiny, { marginTop: 2 }]} numberOfLines={2}>
                  {t(`map.styleHint.${id}`)}
                </Text>
              </Touch>
            );
          })}
        </View>

        <SectionTitle>{t("map.layers")}</SectionTitle>
        <Card>
          {OVERLAYS.map((o, i) => {
            const unavailable = o.needsOutdoor && !source.outdoor;
            return (
              <SwitchRow
                key={o.id}
                icon={o.icon(s.overlays[o.id] && !unavailable ? colors.text : colors.textMuted)}
                title={t(`map.overlay.${o.id}`)}
                subtitle={unavailable ? t("map.needsData") : t(`map.overlayHint.${o.id}`)}
                value={s.overlays[o.id]}
                onChange={() => s.toggleOverlay(o.id)}
                last={i === OVERLAYS.length - 1}
              />
            );
          })}
        </Card>

        {s.overlays.poi && (
          <>
            <SectionTitle
              right={
                <Touch
                  onPress={() => {
                    const target = !allPoi;
                    const next = Object.fromEntries(POI_CATEGORIES.map((c) => [c, target])) as typeof s.poiCategories;
                    s.set("poiCategories", next);
                  }}
                >
                  <Text style={[type.small, { color: colors.route, fontWeight: "700" }]}>
                    {allPoi ? t("map.poiNone") : t("map.poiAll")}
                  </Text>
                </Touch>
              }
            >
              {t("map.poi")}
            </SectionTitle>
            <View style={styles.chips}>
              {POI_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={t(`map.poiCat.${c}`)}
                  selected={s.poiCategories[c]}
                  color={POI_CATEGORY_COLORS[c]}
                  icon={<View style={[styles.dot, { backgroundColor: POI_CATEGORY_COLORS[c] }]} />}
                  onPress={() => s.togglePoiCategory(c)}
                />
              ))}
            </View>
          </>
        )}

        <SectionTitle>{t("map.legend")}</SectionTitle>
        <Card style={{ paddingVertical: space.sm }}>
          {LEGEND.map((l) => (
            <View key={l.key} style={styles.legendRow}>
              <LegendLine color={TRACK_COLORS[l.key]} dash={l.dash} width={l.width} />
              <Text style={[type.body, { flex: 1 }]}>{t(`map.legendItems.${l.key}`)}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle>{t("map.display")}</SectionTitle>
        <Text style={[type.small, { marginBottom: space.sm }]}>{t("map.textSize")}</Text>
        <Segmented
          value={String(s.textScale)}
          onChange={(v) => s.set("textScale", Number(v))}
          options={[
            { value: "0.85", label: "A-" },
            { value: "1", label: "A" },
            { value: "1.2", label: "A+" },
            { value: "1.4", label: "A++" },
          ]}
        />
        <Card style={{ marginTop: space.md }}>
          <SwitchRow
            icon={<Compass size={20} color={colors.text} weight="bold" />}
            title={t("map.rotateWithHeading")}
            value={s.rotateWithHeading}
            onChange={(v) => s.set("rotateWithHeading", v)}
          />
          <SwitchRow
            icon={<Cube size={20} color={colors.text} weight="bold" />}
            title={t("map.tilt3d")}
            value={s.tilt3d}
            onChange={(v) => s.set("tilt3d", v)}
            last
          />
        </Card>

        <SectionTitle>{t("settings.offlineMaps")}</SectionTitle>
        <Card>
          <Row
            icon={<CloudArrowDown size={20} color={source.region ? colors.go : colors.text} weight="bold" />}
            title={source.region ? `${t("map.offlineSource")}: ${source.region}` : t("map.onlineSource")}
            subtitle={t("offline.includes")}
            chevron
            last
            onPress={() => {
              useUi.getState().setMenuOpen(false);
              router.push("/offline");
            }}
          />
        </Card>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  styleRow: { flexDirection: "row", gap: space.sm },
  styleCard: {
    flex: 1,
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  styleOn: { borderColor: colors.accent, backgroundColor: colors.surface3 },
  preview: { borderRadius: radius.sm, overflow: "hidden", alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 7 },
});
