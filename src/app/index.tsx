import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { X } from "@/components/icons";
import { SheetPositionContext } from "@/components/sheet";
import { Touch } from "@/components/ui";
import { SpeedWidget } from "@/features/dash/SpeedWidget";
import { HomeBar } from "@/features/home/HomeBar";
import { FloatingColumn, TopRightControls } from "@/features/map/MapControls";
import { MapMenuSheet } from "@/features/menu/MapMenuSheet";
import { NavBanner } from "@/features/nav/NavBanner";
import { NavBar } from "@/features/nav/NavBar";
import { PlaceSheet } from "@/features/place/PlaceSheet";
import { PlannerSheet } from "@/features/planner/PlannerSheet";
import { SearchSheet } from "@/features/search/SearchSheet";
import { startSpeedLimitWatcher, stopSpeedLimitWatcher } from "@/location/speedLimit";
import { startForegroundWatch } from "@/location/store";
import { MapCanvas } from "@/map/MapCanvas";
import { fitBounds, setSheetInset } from "@/map/controller";
import { useNav } from "@/navigation/store";
import { useOffline } from "@/offline/store";
import { useSettings } from "@/store/settings";
import { useTracks } from "@/store/tracks";
import { useUi } from "@/store/ui";
import { colors, radius, shadow, space, type } from "@/theme";

const KEEP_AWAKE_TAG = "map";
const NAV_BANNER_SPACE = 128;

/** Name of the ride / GPX track currently drawn on the map, with a button to hide it. */
function ShownTrack() {
  const track = useTracks((s) => s.track);
  if (!track) return null;
  return (
    <View style={styles.trackChip}>
      <Touch onPress={() => fitBounds(track.bbox)} style={{ flexShrink: 1 }} haptics={false}>
        <Text style={[type.small, { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
          {track.name}
        </Text>
      </Touch>
      <Touch onPress={() => useTracks.getState().clear()} style={styles.trackClose}>
        <X size={14} color={colors.text} weight="bold" />
      </Touch>
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetPos = useSharedValue(height);
  const panel = useUi((s) => s.panel);
  const navActive = useNav((s) => s.active);
  const keepAwake = useSettings((s) => s.keepAwake);

  useEffect(() => {
    startForegroundWatch();
    startSpeedLimitWatcher();
    useOffline.getState().refreshDownloaded();
    useOffline.getState().loadCatalog();
    return () => stopSpeedLimitWatcher();
  }, []);

  useEffect(() => {
    if (keepAwake) activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    else deactivateKeepAwake(KEEP_AWAKE_TAG);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [keepAwake]);

  useAnimatedReaction(
    () => sheetPos.value,
    (y) => scheduleOnRN(setSheetInset, Math.max(0, height - y)),
    [height],
  );

  const topOffset = insets.top + (navActive ? NAV_BANNER_SPACE : space.sm);

  return (
    <SheetPositionContext.Provider value={sheetPos}>
      <View style={styles.root}>
        <MapCanvas />

        {navActive && <NavBanner />}
        <View style={[styles.topLeft, { top: topOffset }]} pointerEvents="box-none">
          <SpeedWidget />
        </View>
        <View style={[styles.topRight, { top: topOffset }]} pointerEvents="box-none">
          <TopRightControls />
        </View>
        {!navActive && (
          <View style={[styles.topCenter, { top: insets.top + space.sm }]} pointerEvents="box-none">
            <ShownTrack />
          </View>
        )}

        <FloatingColumn />

        {panel === "home" && <HomeBar />}
        {panel === "search" && <SearchSheet />}
        {panel === "place" && <PlaceSheet />}
        {panel === "planner" && <PlannerSheet />}
        {panel === "nav" && navActive && <NavBar />}

        <MapMenuSheet />
      </View>
    </SheetPositionContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topLeft: { position: "absolute", left: space.md },
  topRight: { position: "absolute", right: space.md },
  topCenter: { position: "absolute", left: 120, right: 76, alignItems: "center" },
  trackChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    maxWidth: "100%",
    paddingLeft: space.md,
    paddingRight: 4,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.info,
    ...shadow,
  },
  trackClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
});
