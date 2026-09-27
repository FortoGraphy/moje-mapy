import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Export, NavigationArrow, Path as PathIcon, Trash } from "@/components/icons";
import { TrackPreview } from "@/components/TrackPreview";
import { Touch, haptic } from "@/components/ui";
import { deleteRoute, listRoutes, type SavedRoute } from "@/db/routes";
import { useT } from "@/i18n";
import { startTrackNavigation } from "@/navigation/engine";
import { useRouting } from "@/routing/store";
import { useUi } from "@/store/ui";
import { colors, radius, space, type } from "@/theme";
import { fmtDate, fmtDistance, fmtDuration, fmtElevation } from "@/utils/format";
import { buildGpx, shareGpx } from "@/utils/gpx";

function open(r: SavedRoute) {
  useRouting.getState().loadRoute(r.points, r.profile);
  useUi.setState({ panel: "planner", place: null, droppedPin: null });
  router.dismissTo("/");
}

function ride(r: SavedRoute) {
  haptic.success();
  router.dismissTo("/");
  setTimeout(() => startTrackNavigation(r.geometry), 400);
}

function RouteCard({ route, onDelete }: { route: SavedRoute; onDelete: () => void }) {
  const t = useT();
  const share = () =>
    shareGpx(
      route.name,
      buildGpx({ name: route.name, track: route.geometry.map((c) => ({ lon: c[0], lat: c[1], ele: c[2] })) }),
    ).catch(() => {});
  return (
    <View style={styles.card}>
      <Touch onPress={() => open(route)} style={styles.top}>
        <View style={styles.preview}>
          <TrackPreview coords={route.geometry} width={84} height={84} color={colors.route} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.h3} numberOfLines={1}>
            {route.name}
          </Text>
          <Text style={type.small}>
            {t(`route.profile.${route.profile}`)} · {fmtDate(route.created_at)}
          </Text>
          <View style={styles.stats}>
            <Text style={type.mono}>{fmtDistance(route.distance)}</Text>
            <Text style={type.mono}>{fmtDuration(route.duration)}</Text>
            <Text style={type.mono}>↗ {fmtElevation(route.ascent)}</Text>
          </View>
        </View>
      </Touch>
      <View style={styles.actions}>
        <Touch onPress={() => ride(route)} style={[styles.btn, { backgroundColor: colors.go, flex: 1.4 }]}>
          <NavigationArrow size={18} color={colors.white} weight="fill" />
          <Text style={[styles.btnText, { color: colors.white }]}>{t("route.go")}</Text>
        </Touch>
        <Touch onPress={() => open(route)} style={styles.btn}>
          <PathIcon size={18} color={colors.text} weight="bold" />
          <Text style={styles.btnText}>{t("routes.open")}</Text>
        </Touch>
        <Touch onPress={share} style={styles.iconBtn}>
          <Export size={18} color={colors.text} weight="bold" />
        </Touch>
        <Touch onPress={onDelete} style={styles.iconBtn}>
          <Trash size={18} color={colors.stop} weight="bold" />
        </Touch>
      </View>
    </View>
  );
}

export default function RoutesScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRoutes(listRoutes());
    }, []),
  );

  const remove = (r: SavedRoute) =>
    Alert.alert(t("routes.deleteConfirm"), r.name, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          deleteRoute(r.id);
          setRoutes(listRoutes());
        },
      },
    ]);

  return (
    <FlatList
      data={routes}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <RouteCard route={item} onDelete={() => remove(item)} />}
      contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <PathIcon size={56} color={colors.textMuted} weight="duotone" />
          <Text style={[type.body, { color: colors.textDim, textAlign: "center" }]}>{t("routes.empty")}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, gap: space.md },
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  preview: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.surface2, overflow: "hidden" },
  stats: { flexDirection: "row", gap: space.md, marginTop: 4 },
  actions: { flexDirection: "row", gap: space.sm },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
  },
  btnText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", gap: space.lg, paddingTop: 80, paddingHorizontal: space.xl },
});
