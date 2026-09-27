import { memo } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { Compass, NavigationArrow, Stack, WifiSlash } from "@/components/icons";
import { useSheetPosition } from "@/components/sheet";
import { Fab } from "@/components/ui";
import { t, useT } from "@/i18n";
import { requestForegroundPermission, startForegroundWatch, useLocation } from "@/location/store";
import { cameraRef, resetNorth } from "@/map/controller";
import { useNav } from "@/navigation/store";
import { RecButton } from "@/features/recording/RecButton";
import { useSettings } from "@/store/settings";
import { type FollowMode, useUi } from "@/store/ui";
import { colors, radius, space } from "@/theme";
import { useOnline } from "@/utils/online";

export async function locateMe() {
  if (useLocation.getState().permission !== "granted") {
    const ok = await requestForegroundPermission();
    if (!ok) {
      Alert.alert(t("common.myLocation"), t("map.locationDenied"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("map.openSettings"), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    await startForegroundWatch();
  }
  const ui = useUi.getState();
  const { rotateWithHeading, tilt3d } = useSettings.getState();
  let next: FollowMode;
  if (useNav.getState().active) next = ui.follow === "course" ? "follow" : "course";
  else if (ui.follow === "off") next = rotateWithHeading ? "heading" : "follow";
  else next = ui.follow === "follow" ? "heading" : "follow";

  if (ui.follow === "off") {
    const fix = useLocation.getState().fix;
    if (fix) {
      cameraRef.current?.easeTo({
        center: [fix.lon, fix.lat],
        zoom: Math.max(ui.zoom, 15),
        pitch: tilt3d ? 45 : 0,
        duration: 600,
      });
    }
  }
  ui.setFollow(next);
}

/** Top-right cluster: map menu, compass (when rotated), connectivity. */
export const TopRightControls = memo(function TopRightControls() {
  const t = useT();
  const bearing = useUi((s) => s.bearing);
  const pitch = useUi((s) => s.pitch);
  const online = useOnline();
  const region = useUi((s) => s.source.region);
  const rotated = Math.abs(bearing) > 2 && Math.abs(bearing) < 358;
  return (
    <View style={styles.topRight}>
      <Fab
        icon={<Stack size={24} color={colors.text} weight="bold" />}
        onPress={() => useUi.getState().setMenuOpen(true)}
        accessibilityLabel={t("map.menu")}
      />
      {(rotated || pitch > 5) && (
        <Fab
          size={44}
          icon={
            <View style={{ transform: [{ rotate: `${-bearing - 45}deg` }] }}>
              <Compass size={24} color={colors.accent} weight="fill" />
            </View>
          }
          onPress={resetNorth}
        />
      )}
      {!online && (
        <View style={[styles.badge, { borderColor: region ? colors.go : colors.warn }]}>
          <WifiSlash size={14} color={region ? colors.go : colors.warn} weight="bold" />
          <Text style={styles.badgeText}>{region ? t("map.offlineSource") : t("common.offline")}</Text>
        </View>
      )}
    </View>
  );
});

/** Bottom-right column that floats above the active bottom panel. */
export const FloatingColumn = memo(function FloatingColumn() {
  const pos = useSheetPosition();
  const follow = useUi((s) => s.follow);
  const style = useAnimatedStyle(() => {
    const top = pos ? pos.value : 0;
    return {
      transform: [{ translateY: top > 0 ? top - 136 : 0 }],
      opacity: top > 0 && top < 330 ? 0 : 1,
    };
  });
  const icon =
    follow === "heading" ? (
      <Compass size={24} color={colors.white} weight="fill" />
    ) : (
      <NavigationArrow
        size={24}
        color={follow === "off" ? colors.text : colors.white}
        weight={follow === "off" ? "bold" : "fill"}
        style={{ transform: [{ scaleX: -1 }] }}
      />
    );
  return (
    <Animated.View style={[styles.column, style]} pointerEvents="box-none">
      <RecButton />
      <Fab icon={icon} active={follow !== "off"} onPress={locateMe} accessibilityLabel={t("map.recenter")} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  topRight: { alignItems: "flex-end", gap: space.sm },
  column: { position: "absolute", right: space.md, top: 0, gap: space.md, alignItems: "flex-end" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
  },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: "700" },
});
