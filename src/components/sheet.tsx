import { BottomSheetBackdrop, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { createContext, useContext } from "react";
import { StyleSheet } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { colors, radius } from "@/theme";

export const sheetStyles = StyleSheet.create({
  background: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  handle: { backgroundColor: colors.surface3, width: 40, height: 5 },
  handleWrap: { paddingTop: 8, paddingBottom: 4 },
});

export const sheetProps = {
  backgroundStyle: sheetStyles.background,
  handleIndicatorStyle: sheetStyles.handle,
  handleStyle: sheetStyles.handleWrap,
  keyboardBehavior: "extend" as const,
  keyboardBlurBehavior: "restore" as const,
  android_keyboardInputMode: "adjustResize" as const,
};

export function Backdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} pressBehavior="close" />;
}

/** Screen Y of the top edge of the active bottom panel; floating buttons follow it. */
export const SheetPositionContext = createContext<SharedValue<number> | null>(null);
export const useSheetPosition = () => useContext(SheetPositionContext);
