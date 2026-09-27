import { router } from "expo-router";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CloudArrowDown, Gear, MagnifyingGlass, Motorcycle, Path as PathIcon, Speedometer } from "@/components/icons";
import { useSheetPosition } from "@/components/sheet";
import { Touch } from "@/components/ui";
import { useT } from "@/i18n";
import { useSearch } from "@/search/store";
import { useUi } from "@/store/ui";
import { colors, radius, shadow, space, type } from "@/theme";

function Shortcut({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Touch onPress={onPress} style={styles.shortcut}>
      <View style={styles.shortcutIcon}>{icon}</View>
      <Text style={styles.shortcutText} numberOfLines={1}>
        {label}
      </Text>
    </Touch>
  );
}

export function HomeBar() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const pos = useSheetPosition();
  const { height } = useWindowDimensions();

  return (
    <View
      style={[styles.wrap, { paddingBottom: insets.bottom + space.sm }]}
      onLayout={(e) => {
        if (pos) pos.value = height - e.nativeEvent.layout.height;
      }}
    >
      <Touch
        onPress={() => {
          useSearch.getState().setTarget({ kind: "place" });
          useUi.getState().setPanel("search");
        }}
        style={styles.search}
      >
        <MagnifyingGlass size={22} color={colors.textDim} weight="bold" />
        <Text style={styles.searchText}>{t("map.searchPlaceholder")}</Text>
      </Touch>
      <View style={styles.shortcuts}>
        <Shortcut
          icon={<PathIcon size={22} color={colors.route} weight="bold" />}
          label={t("settings.routes")}
          onPress={() => router.push("/routes")}
        />
        <Shortcut
          icon={<Motorcycle size={22} color={colors.record} weight="bold" />}
          label={t("settings.rides")}
          onPress={() => router.push("/rides")}
        />
        <Shortcut
          icon={<Speedometer size={22} color={colors.go} weight="bold" />}
          label={t("settings.dashboard")}
          onPress={() => router.push("/dashboard")}
        />
        <Shortcut
          icon={<CloudArrowDown size={22} color={colors.info} weight="bold" />}
          label={t("settings.offlineMaps")}
          onPress={() => router.push("/offline")}
        />
        <Shortcut
          icon={<Gear size={22} color={colors.textDim} weight="bold" />}
          label={t("settings.title")}
          onPress={() => router.push("/settings")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.md,
    paddingHorizontal: space.lg,
    ...shadow,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    paddingHorizontal: space.md,
  },
  searchText: { ...type.body, fontSize: 17, color: colors.textMuted, fontWeight: "600" },
  shortcuts: { flexDirection: "row", justifyContent: "space-between", marginTop: space.md },
  shortcut: { alignItems: "center", width: 62, gap: 4 },
  shortcutIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutText: { ...type.tiny, fontSize: 10, color: colors.textDim },
});
