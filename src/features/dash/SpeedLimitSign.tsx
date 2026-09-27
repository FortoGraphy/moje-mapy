import { StyleSheet, Text, View } from "react-native";

import { limitValue } from "@/utils/format";

export function SpeedLimitSign({ kmh, size = 52, flash }: { kmh: number; size?: number; flash?: boolean }) {
  const v = limitValue(kmh);
  return (
    <View
      style={[
        styles.sign,
        { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(4, size * 0.11) },
        flash && { backgroundColor: "#FFE8EA" },
      ]}
      accessibilityLabel={`limit ${v}`}
    >
      <Text style={[styles.text, { fontSize: size * (v >= 100 ? 0.36 : 0.44) }]} allowFontScaling={false}>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sign: { backgroundColor: "#FFFFFF", borderColor: "#E3001B", alignItems: "center", justifyContent: "center" },
  text: { color: "#111", fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -1 },
});
