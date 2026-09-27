import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FlagCheckered, Warning } from "@/components/icons";
import { useT } from "@/i18n";
import { useNav } from "@/navigation/store";
import { maneuverText } from "@/navigation/voice";
import { colors, radius, shadow, space, type } from "@/theme";
import { fmtDistance } from "@/utils/format";

import { ManeuverIcon } from "./ManeuverIcon";

export function NavBanner() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const progress = useNav((s) => s.progress);
  const offRoute = useNav((s) => s.offRoute);
  const rerouting = useNav((s) => s.rerouting);
  const arrived = useNav((s) => s.arrived);
  const mode = useNav((s) => s.mode);

  let body: React.ReactNode;
  let bg: string = colors.go;
  if (arrived) {
    body = (
      <View style={styles.row}>
        <FlagCheckered size={44} color={colors.white} weight="fill" />
        <Text style={styles.big}>{t("nav.arrive")}</Text>
      </View>
    );
  } else if (rerouting) {
    bg = colors.surface3;
    body = (
      <View style={styles.row}>
        <ActivityIndicator color={colors.white} size="large" />
        <Text style={styles.big}>{t("nav.rerouting")}</Text>
      </View>
    );
  } else if (offRoute && progress) {
    bg = colors.warn;
    body = (
      <View style={styles.row}>
        <Warning size={44} color={colors.black} weight="fill" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.big, { color: colors.black }]}>{t("nav.offRoute")}</Text>
          <Text style={[styles.sub, { color: colors.black }]}>
            {mode === "track" ? t("nav.followTrack") : ""} {fmtDistance(progress.offset)}
          </Text>
        </View>
      </View>
    );
  } else if (progress?.next) {
    const n = progress.next;
    body = (
      <>
        <View style={styles.row}>
          <ManeuverIcon type={n.type} exit={n.exit} size={60} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dist}>{fmtDistance(progress.distToNext)}</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {maneuverText(n)}
            </Text>
          </View>
        </View>
        {progress.after && progress.after.at - n.at < 400 && (
          <View style={styles.then}>
            <Text style={styles.thenText}>{t("nav.then")}</Text>
            <ManeuverIcon type={progress.after.type} exit={progress.after.exit} size={22} />
          </View>
        )}
      </>
    );
  } else {
    body = (
      <View style={styles.row}>
        <ActivityIndicator color={colors.white} />
        <Text style={styles.sub}>{t("common.loading")}</Text>
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={[styles.wrap, { top: insets.top + space.sm, backgroundColor: bg }]}
      pointerEvents="none"
    >
      {body}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: space.md,
    right: space.md,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...shadow,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  dist: { ...type.hero, fontSize: 40, letterSpacing: -1, color: colors.white, lineHeight: 44 },
  big: { ...type.h1, color: colors.white, flexShrink: 1 },
  sub: { ...type.h3, color: colors.white, opacity: 0.95 },
  then: {
    position: "absolute",
    right: space.md,
    bottom: -18,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goPressed,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  thenText: { ...type.tiny, color: colors.white, fontWeight: "800" },
});
