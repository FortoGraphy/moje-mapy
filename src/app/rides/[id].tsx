import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AreaChart } from "@/components/charts";
import { Export, MapTrifold, NavigationArrow, PencilSimple, Trash } from "@/components/icons";
import { TrackPreview } from "@/components/TrackPreview";
import { BigButton, Card, SectionTitle, Stat, Touch, haptic } from "@/components/ui";
import { deleteRide, getRide, getRidePoints, getWaypoints, renameRide } from "@/db/rides";
import { useT } from "@/i18n";
import { fitBounds } from "@/map/controller";
import { startTrackNavigation } from "@/navigation/engine";
import { photoUri } from "@/recording/recorder";
import { useTracks } from "@/store/tracks";
import { colors, radius, space, type } from "@/theme";
import {
  fmtClockDuration,
  fmtDate,
  fmtDistance,
  fmtElevation,
  fmtSpeed,
  fmtTime,
  speedValue,
} from "@/utils/format";
import { cumulativeDistances } from "@/utils/geo";
import { buildGpx, shareGpx } from "@/utils/gpx";

function Action({ icon, label, onPress, danger }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Touch onPress={onPress} style={styles.action}>
      {icon}
      <Text style={[styles.actionText, danger && { color: colors.stop }]} numberOfLines={1}>
        {label}
      </Text>
    </Touch>
  );
}

export default function RideDetail() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ride, setRide] = useState(() => getRide(id));
  const points = useMemo(() => getRidePoints(id), [id]);
  const waypoints = useMemo(() => getWaypoints(id), [id]);

  const coords = useMemo(() => points.map((p) => [p.lon, p.lat, p.alt ?? 0] as [number, number, number]), [points]);
  const cum = useMemo(() => cumulativeDistances(coords), [coords]);
  const speeds = useMemo(() => points.map((p) => speedValue(p.speed)), [points]);
  const alts = useMemo(() => points.map((p) => p.alt ?? 0), [points]);
  const hasSpeed = points.some((p) => p.speed != null && p.speed > 0);
  const hasAlt = points.some((p) => p.alt != null);

  if (!ride) return null;

  const avg = ride.moving_time > 0 ? ride.distance / ride.moving_time : 0;

  const showOnMap = () => {
    const tr = useTracks.getState().show({
      id: ride.id,
      name: ride.name,
      coords,
      waypoints: waypoints.map((w) => ({ lon: w.lon, lat: w.lat, name: w.name ?? "", photo: !!w.photo_uri })),
    });
    router.dismissTo("/");
    setTimeout(() => fitBounds(tr.bbox), 500);
  };

  const navigate = () => {
    haptic.success();
    useTracks.getState().show({ id: ride.id, name: ride.name, coords });
    router.dismissTo("/");
    setTimeout(() => startTrackNavigation(coords), 400);
  };

  const share = () => {
    const xml = buildGpx({
      name: ride.name,
      track: points.map((p) => ({ lon: p.lon, lat: p.lat, ele: p.alt, time: ride.source === "recorded" ? p.ts : null })),
      waypoints: waypoints.map((w) => ({ lon: w.lon, lat: w.lat, ele: w.alt, time: w.ts, name: w.name ?? undefined })),
    });
    shareGpx(ride.name, xml).catch(() => {});
  };

  const rename = () => {
    Alert.prompt(
      t("common.rename"),
      undefined,
      (name) => {
        if (!name?.trim()) return;
        renameRide(ride.id, name.trim());
        setRide(getRide(ride.id));
      },
      "plain-text",
      ride.name,
    );
  };

  const remove = () => {
    Alert.alert(t("rec.deleteConfirm"), ride.name, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          deleteRide(ride.id);
          if (useTracks.getState().track?.id === ride.id) useTracks.getState().clear();
          router.back();
        },
      },
    ]);
  };

  const previewW = width - space.lg * 2;
  return (
    <>
      <Stack.Screen options={{ title: ride.name }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        <Touch onPress={showOnMap} style={styles.preview}>
          <TrackPreview coords={coords} width={previewW} height={200} color={ride.source === "imported" ? colors.info : colors.record} strokeWidth={3} />
          <View style={styles.previewBadge}>
            <MapTrifold size={16} color={colors.text} weight="bold" />
          </View>
        </Touch>
        <Text style={[type.small, { marginTop: space.sm }]}>
          {fmtDate(ride.started_at)} · {fmtTime(ride.started_at)}
          {ride.ended_at ? `–${fmtTime(ride.ended_at)}` : ""}
        </Text>

        <Card style={styles.grid}>
          <View style={styles.cell}>
            <Stat big label={t("rec.distance")} value={fmtDistance(ride.distance)} />
          </View>
          <View style={styles.cell}>
            <Stat big label={t("rec.duration")} value={fmtClockDuration(ride.moving_time)} />
          </View>
          <View style={styles.cell}>
            <Stat label={t("rec.avgSpeed")} value={fmtSpeed(avg)} />
          </View>
          <View style={styles.cell}>
            <Stat label={t("rec.maxSpeed")} value={fmtSpeed(ride.max_speed)} />
          </View>
          <View style={styles.cell}>
            <Stat label={t("rec.ascent")} value={fmtElevation(ride.ascent)} />
          </View>
          <View style={styles.cell}>
            <Stat label={t("rec.descent")} value={fmtElevation(ride.descent)} />
          </View>
          <View style={styles.cell}>
            <Stat label={t("rec.totalTime")} value={fmtClockDuration(ride.total_time)} />
          </View>
          <View style={styles.cell}>
            <Stat label={t("rec.maxAlt")} value={fmtElevation(ride.max_alt)} />
          </View>
        </Card>

        <BigButton
          title={t("rec.navigate")}
          color={colors.go}
          icon={<NavigationArrow size={22} color={colors.white} weight="fill" />}
          onPress={navigate}
          style={{ marginTop: space.lg }}
        />

        {hasSpeed && (
          <>
            <SectionTitle>{t("rec.speedChart")}</SectionTitle>
            <Card style={styles.chart}>
              <AreaChart xs={cum} ys={speeds} color={colors.route} fmtY={(v) => `${Math.max(0, Math.round(v))}`} fmtX={fmtDistance} />
            </Card>
          </>
        )}
        {hasAlt && (
          <>
            <SectionTitle>{t("rec.altChart")}</SectionTitle>
            <Card style={styles.chart}>
              <AreaChart xs={cum} ys={alts} color={colors.go} fmtY={(v) => fmtElevation(v)} fmtX={fmtDistance} />
            </Card>
          </>
        )}

        {waypoints.length > 0 && (
          <>
            <SectionTitle>{t("rec.waypoints")}</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {waypoints.map((w) => {
                const uri = photoUri(w.photo_uri);
                return (
                  <View key={w.id} style={styles.wp}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.photo} />
                    ) : (
                      <View style={[styles.photo, styles.noPhoto]}>
                        <Text style={type.h2}>📍</Text>
                      </View>
                    )}
                    <Text style={type.small} numberOfLines={1}>
                      {w.name || fmtTime(w.ts)}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}

        <View style={styles.actions}>
          <Action icon={<Export size={22} color={colors.text} weight="bold" />} label={t("rec.exportGpx")} onPress={share} />
          <Action icon={<MapTrifold size={22} color={colors.text} weight="bold" />} label={t("rec.showOnMap")} onPress={showOnMap} />
          <Action icon={<PencilSimple size={22} color={colors.text} weight="bold" />} label={t("common.rename")} onPress={rename} />
          <Action icon={<Trash size={22} color={colors.stop} weight="bold" />} label={t("common.delete")} onPress={remove} danger />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: "hidden" },
  previewBadge: {
    position: "absolute",
    right: space.sm,
    top: space.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingVertical: space.sm, marginTop: space.lg },
  cell: { width: "50%", paddingVertical: space.sm },
  chart: { paddingVertical: space.md },
  wp: { width: 110, gap: 4 },
  photo: { width: 110, height: 110, borderRadius: radius.md, backgroundColor: colors.surface2 },
  noPhoto: { alignItems: "center", justifyContent: "center" },
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
});
