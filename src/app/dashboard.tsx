import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowCounterClockwise, X } from "@/components/icons";
import { Touch, haptic } from "@/components/ui";
import { SpeedLimitSign } from "@/features/dash/SpeedLimitSign";
import { useT } from "@/i18n";
import { useSpeedLimit } from "@/location/speedLimit";
import { useLocation } from "@/location/store";
import { useRecording } from "@/recording/store";
import { type Trip, useSettings } from "@/store/settings";
import { colors, radius, space, type } from "@/theme";
import {
  compassDir,
  fmtClockDuration,
  fmtDistance,
  fmtElevation,
  fmtTime,
  speedValue,
} from "@/utils/format";

function Cell({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.cellValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={styles.cellUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function TripCard({ id, trip, label }: { id: "a" | "b"; trip: Trip; label: string }) {
  const t = useT();
  const units = useSettings((s) => s.units);
  const avg = trip.movingTime > 0 ? trip.distance / trip.movingTime : 0;
  return (
    <View style={styles.trip}>
      <View style={styles.tripHead}>
        <Text style={styles.tripTitle}>{label}</Text>
        <Touch
          onPress={() =>
            Alert.alert(label, t("dash.resetTrip"), [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("common.reset"),
                style: "destructive",
                onPress: () => {
                  haptic.impact();
                  useSettings.getState().resetTrip(id);
                },
              },
            ])
          }
        >
          <ArrowCounterClockwise size={18} color={colors.textDim} weight="bold" />
        </Touch>
      </View>
      <Text style={styles.tripDist} numberOfLines={1} adjustsFontSizeToFit>
        {fmtDistance(trip.distance)}
      </Text>
      <View style={styles.tripRow}>
        <Text style={styles.tripSmall}>
          {t("dash.moving")} {fmtClockDuration(trip.movingTime)}
        </Text>
        <Text style={styles.tripSmall}>
          Ø {Math.round(speedValue(avg, units))} · max {Math.round(speedValue(trip.maxSpeed, units))}
        </Text>
      </View>
    </View>
  );
}

export default function Dashboard() {
  useKeepAwake();
  const t = useT();
  const insets = useSafeAreaInsets();
  const units = useSettings((s) => s.units);
  const trips = useSettings((s) => s.trips);
  const speed = useLocation((s) => s.displaySpeed);
  const fix = useLocation((s) => s.fix);
  const heading = useLocation((s) => s.heading);
  const grade = useLocation((s) => s.grade);
  const weak = useLocation((s) => s.weak);
  const limit = useSpeedLimit((s) => s.limit);
  const speeding = useSpeedLimit((s) => s.speeding);
  const rec = useRecording();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const dir = fix?.course != null && (fix.speed ?? 0) > 1.5 ? fix.course : heading;
  const avgA = trips.a.movingTime > 0 ? trips.a.distance / trips.a.movingTime : 0;
  const unit = units === "imperial" ? t("dash.speedMph") : t("dash.speed");

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.top}>
        <Touch onPress={() => router.back()} style={styles.close}>
          <X size={22} color={colors.text} weight="bold" />
        </Touch>
        <Text style={styles.clock}>{fmtTime(now)}</Text>
        <View style={styles.gps}>
          <View style={[styles.dot, { backgroundColor: !fix ? colors.textMuted : weak ? colors.warn : colors.go }]} />
          <Text style={type.tiny}>
            {weak ? t("dash.gpsWeak") : fix?.accuracy != null ? `GPS ±${Math.round(fix.accuracy)} m` : "GPS"}
          </Text>
        </View>
      </View>

      <View style={styles.speedBlock}>
        <Text
          style={[styles.speed, speeding && { color: colors.stop }]}
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {fix ? Math.round(speedValue(speed, units)) : "–"}
        </Text>
        <Text style={styles.unit}>{unit}</Text>
        {limit != null && (
          <View style={styles.limit}>
            <SpeedLimitSign kmh={limit} size={78} flash={speeding} />
          </View>
        )}
      </View>

      {rec.status !== "idle" && (
        <View style={styles.recBar}>
          <View style={[styles.dot, { backgroundColor: rec.status === "recording" ? colors.record : colors.warn }]} />
          <Text style={[type.body, { fontWeight: "800" }]}>
            {rec.status === "recording" ? t("rec.recording") : rec.status === "autopaused" ? t("rec.autoPaused") : t("rec.paused")}
          </Text>
          <Text style={[type.mono, { marginLeft: "auto" }]}>
            {fmtDistance(rec.distance)} · {fmtClockDuration(rec.movingTime)}
          </Text>
        </View>
      )}

      <View style={styles.grid}>
        <Cell label={t("dash.max")} value={String(Math.round(speedValue(trips.a.maxSpeed, units)))} unit={unit} />
        <Cell label={t("dash.avg")} value={String(Math.round(speedValue(avgA, units)))} unit={unit} />
        <Cell label={t("dash.altitude")} value={fmtElevation(fix?.alt ?? null, units)} />
        <Cell
          label={t("dash.grade")}
          value={grade == null ? "–" : `${grade > 0 ? "+" : ""}${Math.round(grade)}`}
          unit={grade == null ? undefined : "%"}
          color={grade == null ? undefined : Math.abs(grade) >= 15 ? colors.warn : undefined}
        />
        <Cell label={t("dash.heading")} value={dir == null ? "–" : `${compassDir(dir)} ${Math.round(dir)}°`} />
        <Cell label={t("dash.moving")} value={fmtClockDuration(trips.a.movingTime)} />
      </View>

      <View style={styles.trips}>
        <TripCard id="a" trip={trips.a} label={t("dash.tripA")} />
        <TripCard id="b" trip={trips.b} label={t("dash.tripB")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  clock: { ...type.h3, fontVariant: ["tabular-nums"] },
  gps: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 40, justifyContent: "flex-end" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  speedBlock: { alignItems: "center", justifyContent: "center", flex: 1, minHeight: 180 },
  speed: {
    color: colors.text,
    fontSize: 150,
    fontWeight: "900",
    letterSpacing: -6,
    fontVariant: ["tabular-nums"],
    lineHeight: 160,
  },
  unit: { color: colors.textDim, fontSize: 18, fontWeight: "800", marginTop: -8 },
  limit: { position: "absolute", right: 0, top: 10 },
  recBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  cell: {
    width: "31.9%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.sm + 2,
  },
  cellLabel: { ...type.tiny, fontSize: 10 },
  cellValue: { ...type.mono, fontSize: 20, marginTop: 2 },
  cellUnit: { fontSize: 11, color: colors.textDim, fontWeight: "700" },
  trips: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  trip: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md },
  tripHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tripTitle: { ...type.tiny, fontSize: 11, color: colors.accent },
  tripDist: { ...type.mono, fontSize: 26, marginTop: 2 },
  tripRow: { marginTop: 2, gap: 2 },
  tripSmall: { ...type.tiny, fontVariant: ["tabular-nums"] },
});
