import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  StyleSheet,
  Switch,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";

import { colors, hitSlop, radius, shadow, space, type } from "@/theme";

import { CaretRight } from "./icons";

export const haptic = {
  tap: () => Haptics.selectionAsync().catch(() => {}),
  impact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

type PressProps = Omit<PressableProps, "style"> & { style?: ViewStyle | ViewStyle[]; haptics?: boolean };

/** Pressable with a subtle scale/opacity feedback. */
export function Touch({ style, haptics = true, onPress, children, ...rest }: PressProps & { children?: ReactNode }) {
  return (
    <Pressable
      hitSlop={hitSlop}
      onPress={(e) => {
        if (haptics) haptic.tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [style, pressed && styles.pressed]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export function Fab({
  icon,
  onPress,
  onLongPress,
  active,
  tint,
  size = 50,
  label,
  style,
  accessibilityLabel,
}: {
  icon: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  active?: boolean;
  tint?: string;
  size?: number;
  label?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  return (
    <Touch
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.fab,
        { width: size, height: size, borderRadius: size / 2 },
        active ? { backgroundColor: tint ?? colors.route, borderColor: "transparent" } : null,
        style ?? {},
      ].filter(Boolean) as ViewStyle[]}
    >
      {icon}
      {label ? <Text style={styles.fabLabel}>{label}</Text> : null}
    </Touch>
  );
}

export function BigButton({
  title,
  onPress,
  color = colors.go,
  icon,
  style,
  textColor = colors.white,
  disabled,
  compact,
}: {
  title: string;
  onPress?: () => void;
  color?: string;
  icon?: ReactNode;
  style?: ViewStyle;
  textColor?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Touch
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      style={[
        styles.big,
        compact ? styles.bigCompact : null,
        { backgroundColor: color, opacity: disabled ? 0.45 : 1 },
        style ?? {},
      ].filter(Boolean) as ViewStyle[]}
    >
      {icon}
      <Text style={[styles.bigText, compact ? { fontSize: 15 } : null, { color: textColor }]}>{title}</Text>
    </Touch>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
  chevron,
  destructive,
  last,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  last?: boolean;
}) {
  const body = (
    <View style={[styles.row, !last && styles.rowBorder]}>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.body, destructive && { color: colors.stop }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.small, { marginTop: 2 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <CaretRight size={16} color={colors.textMuted} weight="bold" /> : null}
    </View>
  );
  return onPress ? <Touch onPress={onPress}>{body}</Touch> : body;
}

export function SwitchRow(props: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <Row
      icon={props.icon}
      title={props.title}
      subtitle={props.subtitle}
      last={props.last}
      right={
        <Switch
          value={props.value}
          disabled={props.disabled}
          onValueChange={(v) => {
            haptic.tap();
            props.onChange(v);
          }}
          trackColor={{ true: colors.go, false: colors.surface3 }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.surface3}
        />
      }
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.segment, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Touch key={o.value} onPress={() => onChange(o.value)} style={[styles.segItem, on ? styles.segOn : {}]}>
            <Text style={[styles.segText, on && { color: colors.text }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Touch>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color = colors.route,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  color?: string;
}) {
  return (
    <Touch
      onPress={onPress}
      style={[styles.chip, selected ? { backgroundColor: color + "33", borderColor: color } : {}]}
    >
      {icon}
      <Text style={[styles.chipText, selected && { color: colors.text }]}>{label}</Text>
    </Touch>
  );
}

export function Stat({
  label,
  value,
  unit,
  big,
  align = "left",
  valueStyle,
}: {
  label: string;
  value: string;
  unit?: string;
  big?: boolean;
  align?: "left" | "center";
  valueStyle?: TextStyle;
}) {
  return (
    <View style={{ alignItems: align === "center" ? "center" : "flex-start" }}>
      <Text style={type.tiny}>{label.toUpperCase()}</Text>
      <Text style={[type.mono, big && { fontSize: 24 }, valueStyle]}>
        {value}
        {unit ? <Text style={[type.small, { fontSize: big ? 14 : 12 }]}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  fab: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow,
  },
  fabLabel: { ...type.tiny, fontSize: 9, color: colors.text, marginTop: 1 },
  big: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 56,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    ...shadow,
  },
  bigCompact: { height: 44, paddingHorizontal: space.lg },
  bigText: { fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xl,
    marginBottom: space.sm,
    paddingHorizontal: space.xs,
  },
  section: { ...type.tiny, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase" },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", minHeight: 54, paddingVertical: space.sm, gap: space.md },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: { width: 28, alignItems: "center" },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 3,
  },
  segItem: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radius.sm + 1 },
  segOn: { backgroundColor: colors.surface3 },
  segText: { ...type.small, fontWeight: "700" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { ...type.small, fontWeight: "700" },
});
