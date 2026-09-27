import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FileArrowUp, Motorcycle } from "@/components/icons";
import { TrackPreview } from "@/components/TrackPreview";
import { Touch, haptic } from "@/components/ui";
import { listRides, type RideRow } from "@/db/rides";
import { useT } from "@/i18n";
import { importGpxFile } from "@/recording/importGpx";
import { colors, radius, space, type } from "@/theme";
import { fmtDate, fmtDistance, fmtDuration, fmtElevation } from "@/utils/format";

function RideCard({ ride }: { ride: RideRow }) {
  const t = useT();
  const preview: number[][] = ride.preview ? JSON.parse(ride.preview) : [];
  return (
    <Touch onPress={() => router.push({ pathname: "/rides/[id]", params: { id: ride.id } })} style={styles.card}>
      <View style={styles.preview}>
        <TrackPreview coords={preview} width={84} height={84} color={ride.source === "imported" ? colors.info : colors.record} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.h3} numberOfLines={1}>
          {ride.name}
        </Text>
        <Text style={type.small}>
          {fmtDate(ride.started_at)}
          {ride.source === "imported" ? ` · ${t("rec.imported")}` : ""}
        </Text>
        <View style={styles.stats}>
          <Text style={type.mono}>{fmtDistance(ride.distance)}</Text>
          {ride.moving_time > 0 && <Text style={type.mono}>{fmtDuration(ride.moving_time)}</Text>}
          {ride.ascent > 0 && <Text style={type.mono}>↗ {fmtElevation(ride.ascent)}</Text>}
        </View>
      </View>
    </Touch>
  );
}

export default function RidesScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [rides, setRides] = useState<RideRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRides(listRides());
    }, []),
  );

  const importGpx = async () => {
    try {
      const id = await importGpxFile();
      if (!id) return;
      haptic.success();
      setRides(listRides());
      router.push({ pathname: "/rides/[id]", params: { id } });
    } catch (e) {
      Alert.alert(t("rec.importGpx"), e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Touch onPress={importGpx} style={styles.headerBtn}>
              <FileArrowUp size={22} color={colors.route} weight="bold" />
            </Touch>
          ),
        }}
      />
      <FlatList
        data={rides}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RideCard ride={item} />}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Motorcycle size={56} color={colors.textMuted} weight="duotone" />
            <Text style={[type.body, { textAlign: "center", color: colors.textDim }]}>{t("rec.noRides")}</Text>
            <Touch onPress={importGpx} style={styles.importBtn}>
              <FileArrowUp size={20} color={colors.route} weight="bold" />
              <Text style={[type.body, { color: colors.route, fontWeight: "700" }]}>{t("rec.importGpx")}</Text>
            </Touch>
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  preview: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.surface2, overflow: "hidden" },
  stats: { flexDirection: "row", gap: space.md, marginTop: 4 },
  headerBtn: { paddingHorizontal: space.sm, paddingVertical: 4 },
  empty: { alignItems: "center", gap: space.lg, paddingTop: 80, paddingHorizontal: space.xl },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
  },
});
