import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Camera, Flag, Pause, Play, Stop } from "@/components/icons";
import { Fab, Touch, haptic } from "@/components/ui";
import { t, useT } from "@/i18n";
import {
  addRideWaypoint,
  pauseRecording,
  resumeRecording,
  startRecording,
  stopRecording,
} from "@/recording/recorder";
import { useRecording } from "@/recording/store";
import { colors, radius, shadow, space } from "@/theme";
import { fmtClockDuration, fmtDistance } from "@/utils/format";

async function start() {
  haptic.impact();
  const bg = await startRecording();
  if (!bg) {
    Alert.alert(t("rec.recording"), t("rec.bgDenied"), [
      { text: t("common.ok"), style: "cancel" },
      { text: t("map.openSettings"), onPress: () => Linking.openSettings() },
    ]);
  }
}

function stop() {
  haptic.warn();
  Alert.alert(t("rec.stopConfirm"), undefined, [
    { text: t("common.cancel"), style: "cancel" },
    {
      text: t("rec.discard"),
      style: "destructive",
      onPress: () => stopRecording(false),
    },
    {
      text: t("common.save"),
      onPress: async () => {
        const id = await stopRecording(true);
        haptic.success();
        if (id) router.push({ pathname: "/rides/[id]", params: { id } });
      },
    },
  ]);
}

function waypoint() {
  Alert.prompt(t("rec.addWaypoint"), t("rec.waypointName"), (name) => {
    addRideWaypoint(name?.trim() || null).then(() => haptic.success());
  });
}

async function photo() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Linking.openSettings();
    return;
  }
  const res = await ImagePicker.launchCameraAsync({ quality: 0.7, exif: false });
  if (res.canceled || !res.assets[0]) return;
  await addRideWaypoint(null, res.assets[0].uri);
  haptic.success();
}

function PulseDot({ active }: { active: boolean }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = active ? withRepeat(withTiming(0.25, { duration: 700 }), -1, true) : withTiming(1);
  }, [active, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: active ? colors.record : colors.warn }, style]} />;
}

export function RecButton() {
  const tr = useT();
  const status = useRecording((s) => s.status);
  const distance = useRecording((s) => s.distance);
  const moving = useRecording((s) => s.movingTime);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === "idle") setOpen(false);
  }, [status]);

  if (status === "idle") {
    return (
      <Fab
        icon={<View style={styles.recIcon} />}
        label="REC"
        onPress={start}
        accessibilityLabel={tr("rec.record")}
      />
    );
  }

  const paused = status === "paused";
  return (
    <View style={styles.wrap}>
      {open && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.actions}>
          <Fab size={44} icon={<Camera size={20} color={colors.text} weight="bold" />} onPress={photo} accessibilityLabel={tr("rec.addPhoto")} />
          <Fab size={44} icon={<Flag size={20} color={colors.text} weight="bold" />} onPress={waypoint} accessibilityLabel={tr("rec.addWaypoint")} />
          <Fab
            size={44}
            icon={paused ? <Play size={20} color={colors.go} weight="fill" /> : <Pause size={20} color={colors.warn} weight="fill" />}
            onPress={paused ? resumeRecording : pauseRecording}
            accessibilityLabel={paused ? tr("rec.resume") : tr("rec.pause")}
          />
          <Fab size={44} icon={<Stop size={20} color={colors.record} weight="fill" />} onPress={stop} accessibilityLabel={tr("rec.stop")} />
        </Animated.View>
      )}
      <Touch onPress={() => setOpen((v) => !v)} style={styles.pill}>
        <PulseDot active={status === "recording"} />
        <View>
          <Text style={styles.time}>{fmtClockDuration(moving)}</Text>
          <Text style={styles.dist}>
            {status === "recording" ? fmtDistance(distance) : status === "autopaused" ? tr("rec.autoPaused") : tr("rec.paused")}
          </Text>
        </View>
      </Touch>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "flex-end", gap: space.sm },
  actions: { flexDirection: "row", gap: space.sm },
  recIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.record },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 50,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.record,
    ...shadow,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  time: { color: colors.text, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  dist: { color: colors.textDim, fontSize: 11, fontWeight: "700" },
});
