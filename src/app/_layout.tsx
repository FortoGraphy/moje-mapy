import "@/recording/task";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DarkTheme, SplashScreen, Stack, ThemeProvider, type Theme } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { migrate } from "@/db";
import { applyLanguage, useT } from "@/i18n";
import { installGlyphs } from "@/map/glyphs";
import { restoreRecording } from "@/recording/recorder";
import { useSettings } from "@/store/settings";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const language = useSettings((s) => s.language);
  const t = useT();

  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  useEffect(() => {
    (async () => {
      try {
        SystemUI.setBackgroundColorAsync(colors.bg);
        migrate();
        await installGlyphs();
        await restoreRecording();
      } catch (e) {
        console.warn("startup", e);
      } finally {
        setReady(true);
        SplashScreen.hideAsync();
      }
    })();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <BottomSheetModalProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: "700" },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.bg },
                headerBackButtonDisplayMode: "minimal",
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="dashboard" options={{ headerShown: false, presentation: "fullScreenModal" }} />
              <Stack.Screen name="rides/index" options={{ title: t("rec.rides") }} />
              <Stack.Screen name="rides/[id]" options={{ title: t("rec.ride") }} />
              <Stack.Screen name="routes" options={{ title: t("routes.title") }} />
              <Stack.Screen name="offline" options={{ title: t("offline.title") }} />
              <Stack.Screen name="settings" options={{ title: t("settings.title") }} />
            </Stack>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
