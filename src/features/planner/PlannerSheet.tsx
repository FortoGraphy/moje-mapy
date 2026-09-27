import BottomSheet, { BottomSheetFooter, type BottomSheetFooterProps, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AreaChart, SurfaceBar } from "@/components/charts";
import {
  ArrowsDownUp,
  Bicycle,
  Export,
  FloppyDisk,
  Motorcycle,
  NavigationArrow,
  Path as PathIcon,
  PersonSimpleWalk,
  RoadHorizon,
  Trash,
  Warning,
  WifiSlash,
  X,
} from "@/components/icons";
import { sheetProps, useSheetPosition } from "@/components/sheet";
import { BigButton, Chip, Touch, haptic } from "@/components/ui";
import { saveRoute } from "@/db/routes";
import { useT } from "@/i18n";
import { fitBounds } from "@/map/controller";
import { startNavigation } from "@/navigation/engine";
import { useRouting } from "@/routing/store";
import { useUi } from "@/store/ui";
import { colors, radius, space, type } from "@/theme";
import type { ProfileId, Route } from "@/types";
import { fmtDistance, fmtDuration, fmtElevation, uid } from "@/utils/format";
import { simplify } from "@/utils/geo";
import { buildGpx, shareGpx } from "@/utils/gpx";
import { useOnline } from "@/utils/online";

import { PointList } from "./PointList";

const PROFILES: { id: ProfileId; icon: (c: string) => React.ReactNode }[] = [
  { id: "enduro", icon: (c) => <Motorcycle size={18} color={c} weight="bold" /> },
  { id: "moto_road", icon: (c) => <RoadHorizon size={18} color={c} weight="bold" /> },
  { id: "moto_curvy", icon: (c) => <PathIcon size={18} color={c} weight="bold" /> },
  { id: "hike", icon: (c) => <PersonSimpleWalk size={18} color={c} weight="bold" /> },
  { id: "bike", icon: (c) => <Bicycle size={18} color={c} weight="bold" /> },
];

function routeName(): string {
  const pts = useRouting.getState().points;
  const last = pts[pts.length - 1];
  return last?.place?.name ?? "Trasa";
}

function offroadShare(r: Route): number {
  let off = 0;
  for (const s of r.segments) if (s.surface !== "paved") off += r.cumDist[s.to] - r.cumDist[s.from];
  return r.distance > 0 ? off / r.distance : 0;
}

function Alternative({ route, index, selected, best }: { route: Route; index: number; selected: boolean; best: boolean }) {
  const t = useT();
  return (
    <Touch
      onPress={() => useRouting.getState().select(index)}
      style={[styles.alt, selected ? { borderColor: colors.route, backgroundColor: colors.route + "22" } : {}]}
    >
      <Text style={[type.tiny, selected && { color: colors.route }]}>
        {best ? t("route.fastest") : t("route.alt", { n: index + 1 })}
      </Text>
      <Text style={[type.h3, { marginTop: 2 }]}>{fmtDuration(route.duration)}</Text>
      <Text style={type.small}>
        {fmtDistance(route.distance)} · {Math.round(offroadShare(route) * 100)} % off
      </Text>
    </Touch>
  );
}

function Action({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Touch onPress={onPress} style={styles.action}>
      {icon}
      <Text style={styles.actionText} numberOfLines={1}>
        {label}
      </Text>
    </Touch>
  );
}

export function PlannerSheet() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const pos = useSheetPosition();
  const online = useOnline();
  const profile = useRouting((s) => s.profile);
  const routes = useRouting((s) => s.routes);
  const selected = useRouting((s) => s.selected);
  const status = useRouting((s) => s.status);
  const error = useRouting((s) => s.error);
  const route = routes[selected] ?? null;

  useEffect(() => {
    if (route) fitBounds(route.bbox);
  }, [route]);

  useEffect(() => {
    if (online && status === "error") useRouting.getState().recompute();
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    useRouting.getState().clear();
    useUi.getState().setPanel("home");
  }, []);

  const surfaces = useMemo(
    () => route?.segments.map((s) => ({ surface: s.surface, length: route.cumDist[s.to] - route.cumDist[s.from] })) ?? [],
    [route],
  );
  const elevation = useMemo(
    () => (route ? { xs: route.cumDist, ys: route.coords.map((c) => c[2]) } : null),
    [route],
  );

  const save = () => {
    if (!route) return;
    Alert.prompt(
      t("route.saveRoute"),
      t("route.routeName"),
      (name) => {
        const pts = useRouting.getState().points;
        saveRoute({
          id: uid("sr"),
          name: name?.trim() || routeName(),
          profile: route.profile,
          created_at: Date.now(),
          distance: route.distance,
          duration: route.duration,
          ascent: route.ascent,
          points: pts,
          geometry: simplify(route.coords, 2),
        });
        haptic.success();
      },
      "plain-text",
      routeName(),
    );
  };

  const exportGpx = () => {
    if (!route) return;
    const pts = useRouting.getState().points;
    const name = routeName();
    const xml = buildGpx({
      name,
      track: route.coords.map((c) => ({ lon: c[0], lat: c[1], ele: c[2] })),
      waypoints: pts
        .filter((p) => p.place)
        .map((p) => ({ lon: p.place!.lon, lat: p.place!.lat, name: p.place!.name })),
    });
    shareGpx(name, xml).catch(() => {});
  };

  const go = () => {
    if (!route) return;
    haptic.success();
    startNavigation(route);
  };

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
          <BigButton
            title={t("route.go")}
            color={colors.go}
            icon={<NavigationArrow size={24} color={colors.white} weight="fill" />}
            onPress={go}
            disabled={!route || status === "computing"}
          />
        </View>
      </BottomSheetFooter>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route, status, insets.bottom, t],
  );

  return (
    <BottomSheet
      {...sheetProps}
      index={0}
      snapPoints={["46%", "90%"]}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      animatedPosition={pos ?? undefined}
      footerComponent={renderFooter}
    >
      <View style={styles.head}>
        <Text style={type.h2}>{t("route.planner")}</Text>
        <Touch onPress={close} style={styles.close}>
          <X size={18} color={colors.text} weight="bold" />
        </Touch>
      </View>
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 110 }}>
        <PointList />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profiles}>
          {PROFILES.map((p) => (
            <Chip
              key={p.id}
              label={t(`route.profile.${p.id}`)}
              selected={profile === p.id}
              color={colors.go}
              icon={p.icon(profile === p.id ? colors.go : colors.textDim)}
              onPress={() => useRouting.getState().setProfile(p.id)}
            />
          ))}
        </ScrollView>

        {!online ? (
          <View style={styles.status}>
            <WifiSlash size={18} color={colors.warn} weight="bold" />
            <Text style={[type.small, { flex: 1 }]}>{t("route.needsOnline")}</Text>
          </View>
        ) : status === "computing" ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.textDim} />
            <Text style={type.small}>{t("route.computing")}</Text>
          </View>
        ) : status === "error" ? (
          <Touch onPress={() => useRouting.getState().recompute()} style={styles.status}>
            <Warning size={18} color={colors.stop} weight="bold" />
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: colors.stop }]}>{t("route.failed")}</Text>
              {error ? (
                <Text style={type.tiny} numberOfLines={2}>
                  {error}
                </Text>
              ) : null}
            </View>
            <Text style={[type.small, { color: colors.route, fontWeight: "700" }]}>{t("common.retry")}</Text>
          </Touch>
        ) : null}

        {routes.length > 1 && (
          <View style={styles.alts}>
            {routes.map((r, i) => (
              <Alternative key={r.id} route={r} index={i} selected={i === selected} best={i === 0} />
            ))}
          </View>
        )}

        {route && (
          <>
            <View style={styles.summary}>
              <View>
                <Text style={[type.h1, { color: colors.go }]}>{fmtDuration(route.duration)}</Text>
                <Text style={type.small}>{fmtDistance(route.distance)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={type.mono}>↗ {fmtElevation(route.ascent)}</Text>
                <Text style={type.mono}>↘ {fmtElevation(route.descent)}</Text>
              </View>
            </View>

            <Text style={styles.section}>{t("route.surfaces")}</Text>
            <SurfaceBar parts={surfaces} label={(s) => t(`route.surface.${s}`)} fmt={fmtDistance} />

            {elevation && (
              <>
                <Text style={styles.section}>{t("route.elevation")}</Text>
                <AreaChart
                  xs={elevation.xs}
                  ys={elevation.ys}
                  color={colors.go}
                  fmtY={(v) => fmtElevation(v)}
                  fmtX={(v) => fmtDistance(v)}
                />
              </>
            )}

            <View style={styles.actions}>
              <Action icon={<FloppyDisk size={22} color={colors.text} weight="bold" />} label={t("common.save")} onPress={save} />
              <Action icon={<Export size={22} color={colors.text} weight="bold" />} label="GPX" onPress={exportGpx} />
              <Action
                icon={<ArrowsDownUp size={22} color={colors.text} weight="bold" />}
                label={t("route.reverse")}
                onPress={() => useRouting.getState().reverse()}
              />
              <Action icon={<Trash size={22} color={colors.stop} weight="bold" />} label={t("route.clear")} onPress={close} />
            </View>
          </>
        )}
        {!route && status === "idle" && <Text style={[type.small, styles.hint]}>{t("route.tapMapHint")}</Text>}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  profiles: { gap: space.sm, paddingVertical: space.md },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  alts: { flexDirection: "row", gap: space.sm, marginBottom: space.sm },
  alt: {
    flex: 1,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.sm,
  },
  section: { ...type.tiny, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", marginTop: space.lg, marginBottom: space.sm },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  action: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  actionText: { ...type.tiny, color: colors.text },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, backgroundColor: colors.surface },
  hint: { textAlign: "center", marginTop: space.lg },
});
