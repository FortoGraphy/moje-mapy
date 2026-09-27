import { Alert, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MapTrifold, SpeakerHigh, SpeakerSlash } from "@/components/icons";
import { useSheetPosition } from "@/components/sheet";
import { Touch, haptic } from "@/components/ui";
import { useT } from "@/i18n";
import { fitBounds } from "@/map/controller";
import { stopNavigation, toggleMute } from "@/navigation/engine";
import { useNav } from "@/navigation/store";
import { colors, radius, shadow, space, type } from "@/theme";
import { fmtDistance, fmtDuration, fmtTime } from "@/utils/format";

export function NavBar() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const pos = useSheetPosition();
  const { height } = useWindowDimensions();
  const progress = useNav((s) => s.progress);
  const route = useNav((s) => s.route);
  const muted = useNav((s) => s.muted);
  const arrived = useNav((s) => s.arrived);

  const remaining = progress?.remaining ?? route?.distance ?? 0;
  const remainingTime = progress?.remainingTime ?? route?.duration ?? 0;
  const eta = progress?.eta ?? Date.now() + remainingTime * 1000;

  const end = () => {
    if (arrived) {
      stopNavigation();
      return;
    }
    haptic.warn();
    Alert.alert(t("nav.endConfirm"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("route.end"), style: "destructive", onPress: stopNavigation },
    ]);
  };

  return (
    <View
      style={[styles.wrap, { paddingBottom: insets.bottom + space.sm }]}
      onLayout={(e) => {
        if (pos) pos.value = height - e.nativeEvent.layout.height;
      }}
    >
      <Touch onPress={toggleMute} style={styles.round}>
        {muted ? (
          <SpeakerSlash size={22} color={colors.warn} weight="bold" />
        ) : (
          <SpeakerHigh size={22} color={colors.text} weight="bold" />
        )}
      </Touch>
      <Touch onPress={() => route && fitBounds(route.bbox)} style={styles.info} haptics={false}>
        <Text style={styles.eta}>{fmtTime(eta)}</Text>
        <Text style={type.small}>
          {fmtDuration(remainingTime)} · {fmtDistance(remaining)}
        </Text>
      </Touch>
      <Touch onPress={() => route && fitBounds(route.bbox)} style={styles.round}>
        <MapTrifold size={22} color={colors.text} weight="bold" />
      </Touch>
      <Touch onPress={end} style={styles.end}>
        <Text style={styles.endText}>{t("route.end")}</Text>
      </Touch>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.md,
    paddingHorizontal: space.md,
    ...shadow,
  },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, alignItems: "center" },
  eta: { ...type.h1, color: colors.go, fontVariant: ["tabular-nums"] },
  end: {
    height: 46,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.stop,
    alignItems: "center",
    justifyContent: "center",
  },
  endText: { color: colors.white, fontSize: 17, fontWeight: "800" },
});
