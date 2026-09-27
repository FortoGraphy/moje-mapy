import { router } from "expo-router";
import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Touch } from "@/components/ui";
import { useT } from "@/i18n";
import { useSpeedLimit } from "@/location/speedLimit";
import { useLocation } from "@/location/store";
import { useSettings } from "@/store/settings";
import { colors, radius, shadow } from "@/theme";
import { fmtElevation, speedValue } from "@/utils/format";

import { SpeedLimitSign } from "./SpeedLimitSign";

/** Compact floating speedometer (top-left). Tap opens the full dashboard. */
export const SpeedWidget = memo(function SpeedWidget() {
  const t = useT();
  const speed = useLocation((s) => s.displaySpeed);
  const alt = useLocation((s) => s.fix?.alt ?? null);
  const weak = useLocation((s) => s.weak);
  const hasFix = useLocation((s) => s.fix != null);
  const units = useSettings((s) => s.units);
  const limit = useSpeedLimit((s) => s.limit);
  const speeding = useSpeedLimit((s) => s.speeding);

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (speeding) pulse.value = withRepeat(withTiming(1, { duration: 450 }), -1, true);
    else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [speeding, pulse]);
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pulse.value, [0, 0.01, 1], [colors.surface, "#7A0018", "#E4002B"]),
  }));

  return (
    <Touch onPress={() => router.push("/dashboard")} accessibilityLabel={t("dash.title")}>
      <Animated.View style={[styles.card, animated]}>
        <View style={styles.speedCol}>
          <Text style={[styles.speed, !hasFix && { color: colors.textMuted }]} allowFontScaling={false}>
            {hasFix ? Math.round(speedValue(speed, units)) : "–"}
          </Text>
          <Text style={styles.unit}>{units === "imperial" ? t("dash.speedMph") : t("dash.speed")}</Text>
        </View>
        {limit != null && <SpeedLimitSign kmh={limit} size={44} flash={speeding} />}
      </Animated.View>
      <View style={styles.sub}>
        <View style={[styles.gpsDot, { backgroundColor: !hasFix ? colors.textMuted : weak ? colors.warn : colors.go }]} />
        <Text style={styles.subText}>{fmtElevation(alt, units)}</Text>
      </View>
    </Touch>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minWidth: 76,
    ...shadow,
  },
  speedCol: { alignItems: "center", minWidth: 50 },
  speed: { color: colors.text, fontSize: 34, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -1.5, lineHeight: 38 },
  unit: { color: colors.textDim, fontSize: 10, fontWeight: "700", marginTop: -2 },
  sub: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  gpsDot: { width: 7, height: 7, borderRadius: 4 },
  subText: { color: colors.textDim, fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
