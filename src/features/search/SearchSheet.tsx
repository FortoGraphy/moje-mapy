import BottomSheet, { BottomSheetFlatList, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Crosshair, MagnifyingGlass, WifiSlash, X } from "@/components/icons";
import { sheetProps, useSheetPosition } from "@/components/sheet";
import { Chip, Touch } from "@/components/ui";
import { clearRecent, listRecent, listSavedPlaces, pushRecent } from "@/db/places";
import { useT } from "@/i18n";
import { useLocation } from "@/location/store";
import { flyTo } from "@/map/controller";
import { useOffline } from "@/offline/store";
import { useRouting } from "@/routing/store";
import { offlineSearch } from "@/search/offline";
import { NEARBY_CATEGORIES, type NearbyCategory, searchNearby } from "@/search/overpass";
import { photonSearch } from "@/search/photon";
import { useSearch } from "@/search/store";
import { useUi } from "@/store/ui";
import { colors, radius, space, type } from "@/theme";
import type { Place } from "@/types";
import { fmtDistance } from "@/utils/format";
import { haversine } from "@/utils/geo";
import { useOnline } from "@/utils/online";

import { PlaceIcon } from "./PlaceIcon";

type Item =
  | { kind: "header"; key: string; title: string; action?: { label: string; onPress: () => void } }
  | { kind: "place"; key: string; place: Place; variant?: "recent" | "saved" }
  | { kind: "myLocation"; key: string }
  | { kind: "status"; key: string; text: string; loading?: boolean };

function near(): [number, number] {
  const f = useLocation.getState().fix;
  return f ? [f.lon, f.lat] : useUi.getState().center;
}

/** Applies a picked result according to where the search was opened from. */
export function pickPlace(place: Place | null, isMyLocation = false) {
  const { target } = useSearch.getState();
  const ui = useUi.getState();
  Keyboard.dismiss();
  if (target.kind === "routePoint") {
    useRouting.getState().setPoint(target.index, place, isMyLocation);
    ui.setPanel("planner");
  } else if (target.kind === "addStop") {
    if (place) useRouting.getState().addStop(place);
    ui.setPanel("planner");
  } else if (place) {
    pushRecent(place);
    ui.showPlace(place);
    flyTo([place.lon, place.lat], 15);
  }
  useSearch.getState().setTarget({ kind: "place" });
}

export function SearchSheet() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const pos = useSheetPosition();
  const online = useOnline();
  const target = useSearch((s) => s.target);
  const query = useSearch((s) => s.query);
  const setQuery = useSearch((s) => s.setQuery);
  const downloaded = useOffline((s) => s.downloaded);

  const [offline, setOffline] = useState<Place[]>([]);
  const [remote, setRemote] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<NearbyCategory | null>(null);
  const [recent, setRecent] = useState<Place[]>(() => listRecent());
  const saved = useMemo(() => listSavedPlaces(), []);
  const abort = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    Keyboard.dismiss();
    const tk = useSearch.getState().target.kind;
    useSearch.getState().setTarget({ kind: "place" });
    useUi.getState().setPanel(tk === "place" ? "home" : "planner");
  }, []);

  useEffect(() => {
    abort.current?.abort();
    const q = query.trim();
    if (category) return;
    if (q.length < 2) {
      setOffline([]);
      setRemote([]);
      setLoading(false);
      return;
    }
    setOffline(offlineSearch(q, downloaded, near()));
    if (!online) {
      setRemote([]);
      return;
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    const timer = setTimeout(() => {
      photonSearch(q, near(), { signal: ctrl.signal })
        .then((r) => !ctrl.signal.aborted && setRemote(r))
        .catch(() => !ctrl.signal.aborted && setRemote([]))
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, online, downloaded, category]);

  const runCategory = useCallback(
    (c: NearbyCategory) => {
      if (category === c) {
        setCategory(null);
        setRemote([]);
        return;
      }
      setCategory(c);
      setQuery("");
      setOffline([]);
      setRemote([]);
      if (!online) return;
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      searchNearby(c, near(), 10000, ctrl.signal)
        .then((r) => !ctrl.signal.aborted && setRemote(r))
        .catch(() => !ctrl.signal.aborted && setRemote([]))
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    },
    [category, online, setQuery],
  );

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const q = query.trim();
    if (target.kind === "routePoint" && !q) out.push({ kind: "myLocation", key: "me" });
    if (!q && !category) {
      if (saved.length) {
        out.push({ kind: "header", key: "h-saved", title: t("search.savedPlaces") });
        saved.slice(0, 8).forEach((p) => out.push({ kind: "place", key: `s-${p.id}`, place: p, variant: "saved" }));
      }
      if (recent.length) {
        out.push({
          kind: "header",
          key: "h-recent",
          title: t("search.recent"),
          action: {
            label: t("search.clearRecent"),
            onPress: () => {
              clearRecent();
              setRecent([]);
            },
          },
        });
        recent.forEach((p) => out.push({ kind: "place", key: `r-${p.id}`, place: p, variant: "recent" }));
      }
      return out;
    }
    if (offline.length) {
      out.push({ kind: "header", key: "h-off", title: t("search.offlineResults") });
      offline.forEach((p) => out.push({ kind: "place", key: `o-${p.id}`, place: p }));
    }
    if (remote.length) {
      out.push({ kind: "header", key: "h-on", title: category ? t("search.nearby") : t("search.onlineResults") });
      const offIds = new Set(offline.map((p) => `${p.name}|${p.lon.toFixed(3)}`));
      remote
        .filter((p) => !offIds.has(`${p.name}|${p.lon.toFixed(3)}`))
        .forEach((p) => out.push({ kind: "place", key: `n-${p.id}`, place: p }));
    }
    if (loading) out.push({ kind: "status", key: "loading", text: t("search.searching"), loading: true });
    else if (!online) out.push({ kind: "status", key: "offline", text: t("search.offlineOnly") });
    else if (!offline.length && !remote.length) out.push({ kind: "status", key: "none", text: t("search.noResults") });
    return out;
  }, [query, category, target.kind, saved, recent, offline, remote, loading, online, t]);

  const here = near();
  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case "header":
        return (
          <View style={styles.header}>
            <Text style={styles.headerText}>{item.title}</Text>
            {item.action && (
              <Touch onPress={item.action.onPress}>
                <Text style={[type.small, { color: colors.route, fontWeight: "700" }]}>{item.action.label}</Text>
              </Touch>
            )}
          </View>
        );
      case "myLocation":
        return (
          <Touch onPress={() => pickPlace(null, true)} style={styles.row}>
            <View style={[styles.meIcon]}>
              <Crosshair size={20} color={colors.white} weight="bold" />
            </View>
            <Text style={[type.body, { flex: 1, fontWeight: "700" }]}>{t("common.myLocation")}</Text>
          </Touch>
        );
      case "status":
        return (
          <View style={styles.status}>
            {item.loading ? <ActivityIndicator color={colors.textDim} /> : !online ? <WifiSlash size={18} color={colors.textDim} /> : null}
            <Text style={type.small}>{item.text}</Text>
          </View>
        );
      case "place": {
        const p = item.place;
        const d = haversine(here, [p.lon, p.lat]);
        return (
          <Touch onPress={() => pickPlace(p)} style={styles.row}>
            <PlaceIcon category={p.category} variant={item.variant} />
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { fontWeight: "700" }]} numberOfLines={1}>
                {p.name}
              </Text>
              {p.subtitle ? (
                <Text style={type.small} numberOfLines={1}>
                  {p.subtitle}
                </Text>
              ) : null}
            </View>
            <Text style={[type.small, { fontVariant: ["tabular-nums"] }]}>{fmtDistance(d)}</Text>
          </Touch>
        );
      }
    }
  };

  const placeholder =
    target.kind === "routePoint"
      ? target.index === 0
        ? t("route.from")
        : t("route.to")
      : target.kind === "addStop"
        ? t("route.addStop")
        : t("map.searchPlaceholder");

  return (
    <BottomSheet
      {...sheetProps}
      index={0}
      snapPoints={["92%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={close}
      animatedPosition={pos ?? undefined}
    >
      <View style={styles.inputWrap}>
        <View style={styles.input}>
          <MagnifyingGlass size={20} color={colors.textDim} weight="bold" />
          <BottomSheetTextInput
            autoFocus
            value={query}
            onChangeText={(v) => {
              setCategory(null);
              setQuery(v);
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.textInput}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
            keyboardAppearance="dark"
          />
        </View>
        <Touch onPress={close} style={styles.closeBtn}>
          <X size={20} color={colors.text} weight="bold" />
        </Touch>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {(Object.keys(NEARBY_CATEGORIES) as NearbyCategory[]).map((c) => (
            <Chip
              key={c}
              label={t(`search.cat.${c}`)}
              selected={category === c}
              onPress={() => runCategory(c)}
              icon={<PlaceIcon category={NEARBY_CATEGORIES[c].cls} size={20} />}
            />
          ))}
        </ScrollView>
      </View>
      <BottomSheetFlatList
        data={items}
        keyExtractor={(i: Item) => i.key}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 40 }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  inputWrap: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingTop: 4 },
  input: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 46,
  },
  textInput: { flex: 1, color: colors.text, fontSize: 17, fontWeight: "600", height: 46 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space.md,
    marginBottom: space.xs,
  },
  headerText: { ...type.tiny, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  meIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.route,
    alignItems: "center",
    justifyContent: "center",
  },
  status: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.lg, justifyContent: "center" },
});
