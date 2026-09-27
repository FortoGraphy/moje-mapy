import { Image, StyleSheet, View } from "react-native";

import { Clock, MapPin, Star } from "@/components/icons";
import { MAP_ICONS } from "@/map/icons.generated";
import { colors } from "@/theme";

const ALIASES: Record<string, string> = {
  supermarket: "grocery",
  convenience: "grocery",
  hotel: "lodging",
  guest_house: "lodging",
  hostel: "lodging",
  motel: "lodging",
  chalet: "lodging",
  camp_site: "campsite",
  pub: "bar",
  motorcycle_repair: "motorcycle",
  car_repair: "car",
  peak: "peak",
  bus_stop: "bus",
  station: "railway",
};

type Variant = "default" | "recent" | "saved";

export function PlaceIcon({ category, variant = "default", size = 36 }: { category?: string; variant?: Variant; size?: number }) {
  if (variant !== "default") {
    const Icon = variant === "recent" ? Clock : Star;
    return (
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        <Icon size={size * 0.5} color={variant === "saved" ? colors.warn : colors.textDim} weight="fill" />
      </View>
    );
  }
  const cls = category ? (ALIASES[category] ?? category) : undefined;
  const key = cls ? (`poi-${cls}` as keyof typeof MAP_ICONS) : undefined;
  const src = key && key in MAP_ICONS ? MAP_ICONS[key] : null;
  if (src) return <Image source={src} style={{ width: size, height: size }} />;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <MapPin size={size * 0.5} color={colors.text} weight="fill" />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
});
