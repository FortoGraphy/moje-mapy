import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Crosshair, DotsSixVertical, FlagCheckered, Plus, X } from "@/components/icons";
import { Touch, haptic } from "@/components/ui";
import { useT } from "@/i18n";
import { useRouting } from "@/routing/store";
import { useSearch } from "@/search/store";
import { useUi } from "@/store/ui";
import { colors, radius, space, type } from "@/theme";
import type { RoutePoint } from "@/types";

const ROW_H = 50;

function editPoint(index: number) {
  useSearch.getState().setQuery("");
  useSearch.getState().setTarget({ kind: "routePoint", index });
  useUi.getState().setPanel("search");
}

function Marker({ index, count, me }: { index: number; count: number; me?: boolean }) {
  if (index === 0) {
    return (
      <View style={[styles.marker, { backgroundColor: colors.go }]}>
        {me ? <Crosshair size={14} color={colors.white} weight="bold" /> : <View style={styles.innerDot} />}
      </View>
    );
  }
  if (index === count - 1) {
    return (
      <View style={[styles.marker, { backgroundColor: colors.stop }]}>
        <FlagCheckered size={13} color={colors.white} weight="fill" />
      </View>
    );
  }
  return (
    <View style={[styles.marker, { backgroundColor: colors.warn }]}>
      <Text style={styles.markerText}>{index}</Text>
    </View>
  );
}

function Row({
  point,
  index,
  count,
  active,
  target,
  dragY,
  onMove,
}: {
  point: RoutePoint;
  index: number;
  count: number;
  active: SharedValue<number>;
  target: SharedValue<number>;
  dragY: SharedValue<number>;
  onMove: (from: number, to: number) => void;
}) {
  const t = useT();
  const pan = Gesture.Pan()
    .minDistance(2)
    .onStart(() => {
      active.value = index;
      target.value = index;
      dragY.value = 0;
      scheduleOnRN(haptic.tap);
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      target.value = Math.max(0, Math.min(count - 1, Math.round(index + e.translationY / ROW_H)));
    })
    .onFinalize(() => {
      if (active.value !== index) return;
      scheduleOnRN(onMove, index, target.value);
    });

  const style = useAnimatedStyle(() => {
    const a = active.value;
    if (a < 0) return { transform: [{ translateY: 0 }], zIndex: 0 };
    if (a === index) return { transform: [{ translateY: dragY.value }], zIndex: 10, opacity: 0.95 };
    const tg = target.value;
    let y = 0;
    if (a < index && index <= tg) y = -ROW_H;
    else if (tg <= index && index < a) y = ROW_H;
    return { transform: [{ translateY: withTiming(y, { duration: 140 }) }], zIndex: 0 };
  });

  const label = point.isMyLocation ? t("common.myLocation") : point.place?.name;
  const placeholder = index === 0 ? t("route.from") : index === count - 1 ? t("route.to") : t("route.stop");
  const removable = count > 2;

  return (
    <Animated.View style={[styles.row, style]}>
      <Marker index={index} count={count} me={point.isMyLocation} />
      <Touch onPress={() => editPoint(index)} style={styles.field}>
        <Text style={[type.body, !label && { color: colors.textMuted }]} numberOfLines={1}>
          {label ?? placeholder}
        </Text>
      </Touch>
      {removable && (
        <Touch onPress={() => useRouting.getState().removePoint(index)} style={styles.iconBtn}>
          <X size={16} color={colors.textDim} weight="bold" />
        </Touch>
      )}
      <GestureDetector gesture={pan}>
        <View style={styles.iconBtn} hitSlop={8}>
          <DotsSixVertical size={20} color={colors.textDim} weight="bold" />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

export function PointList() {
  const t = useT();
  const points = useRouting((s) => s.points);
  const active = useSharedValue(-1);
  const target = useSharedValue(-1);
  const dragY = useSharedValue(0);

  const onMove = (from: number, to: number) => {
    if (from !== to) {
      haptic.impact();
      useRouting.getState().movePoint(from, to);
    }
    requestAnimationFrame(() => {
      active.value = -1;
      dragY.value = 0;
    });
  };

  return (
    <View style={styles.list}>
      <View style={[styles.rail, { height: Math.max(0, (points.length - 1) * ROW_H) }]} />
      {points.map((p, i) => (
        <Row
          key={p.key}
          point={p}
          index={i}
          count={points.length}
          active={active}
          target={target}
          dragY={dragY}
          onMove={onMove}
        />
      ))}
      {points.length < 10 && (
        <Touch
          onPress={() => {
            useSearch.getState().setQuery("");
            useSearch.getState().setTarget({ kind: "addStop" });
            useUi.getState().setPanel("search");
          }}
          style={styles.add}
        >
          <View style={[styles.marker, { backgroundColor: colors.surface3 }]}>
            <Plus size={14} color={colors.text} weight="bold" />
          </View>
          <Text style={[type.body, { color: colors.route, fontWeight: "700" }]}>{t("route.addStop")}</Text>
        </Touch>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.surface2, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 4 },
  rail: {
    position: "absolute",
    left: space.md + 12,
    top: 4 + ROW_H / 2,
    width: 2,
    backgroundColor: colors.surface3,
  },
  row: { height: ROW_H, flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface2 },
  marker: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  innerDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.white },
  markerText: { color: colors.black, fontSize: 13, fontWeight: "800" },
  field: {
    flex: 1,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface3,
  },
  iconBtn: { width: 30, height: 40, alignItems: "center", justifyContent: "center" },
  add: { height: 46, flexDirection: "row", alignItems: "center", gap: space.sm },
});
