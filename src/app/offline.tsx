import { Camera, GeoJSONSource, Layer, Map, type MapRef, type PressEvent } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, type NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowClockwise, Check, CloudArrowDown, Pause, Play, Trash, X } from "@/components/icons";
import { Card, Row, SectionTitle, Segmented, SwitchRow, Touch, haptic } from "@/components/ui";
import { DEFAULT_CENTER, dataUrl } from "@/config";
import type { RegionKind } from "@/db/regions";
import { useLang, useT } from "@/i18n";
import { glyphsUrl } from "@/map/glyphs";
import { resolveSources } from "@/map/sources";
import { buildStyle } from "@/map/style/buildStyle";
import type { CatalogRegion } from "@/offline/catalog";
import { cancelDownload, deleteRegion, downloadRegion, freeSpace, pauseDownload, resumeDownload } from "@/offline/downloader";
import { useOffline } from "@/offline/store";
import { useSettings } from "@/store/settings";
import { colors, radius, space, type } from "@/theme";
import { fmtBytes, fmtDate } from "@/utils/format";
import { inBbox } from "@/utils/geo";

const KINDS: RegionKind[] = ["country", "region", "district"];

function start(region: CatalogRegion) {
  try {
    haptic.impact();
    downloadRegion(region);
  } catch (e) {
    Alert.alert(region.name.cs, e instanceof Error ? e.message : String(e));
  }
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { width: `${Math.min(100, Math.max(2, value * 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

function RegionRow({ region, last }: { region: CatalogRegion; last?: boolean }) {
  const t = useT();
  const lang = useLang();
  const dl = useOffline((s) => s.downloads[region.id]);
  const have = useOffline((s) => s.downloaded.find((d) => d.id === region.id));
  const outdated = have && have.version !== region.version;

  let right: React.ReactNode;
  if (dl) {
    const paused = dl.state === "paused" || dl.state === "error";
    right = (
      <View style={styles.rowBtns}>
        <Touch onPress={() => (paused ? resumeDownload(region.id) : pauseDownload(region.id))} style={styles.iconBtn}>
          {paused ? <Play size={18} color={colors.go} weight="fill" /> : <Pause size={18} color={colors.text} weight="fill" />}
        </Touch>
        <Touch onPress={() => cancelDownload(region.id)} style={styles.iconBtn}>
          <X size={18} color={colors.textDim} weight="bold" />
        </Touch>
      </View>
    );
  } else if (have && !outdated) {
    right = <Check size={22} color={colors.go} weight="bold" />;
  } else {
    right = (
      <Touch onPress={() => start(region)} style={[styles.dlBtn, outdated ? { backgroundColor: colors.warn } : {}]}>
        {outdated ? <ArrowClockwise size={16} color={colors.black} weight="bold" /> : <CloudArrowDown size={16} color={colors.white} weight="bold" />}
        <Text style={[styles.dlText, outdated && { color: colors.black }]}>{outdated ? t("offline.update") : fmtBytes(region.size)}</Text>
      </Touch>
    );
  }

  const subtitle = dl
    ? dl.state === "error"
      ? `${t("offline.failed")}: ${dl.error ?? ""}`
      : dl.state === "paused"
        ? `${t("offline.paused")} · ${fmtBytes(dl.bytes)} / ${fmtBytes(dl.total)}`
        : dl.state === "queued"
          ? t("common.loading")
          : `${t("offline.downloading", { p: Math.floor((dl.bytes / Math.max(1, dl.total)) * 100) })} · ${fmtBytes(dl.bytes)} / ${fmtBytes(dl.total)}`
    : outdated
      ? t("offline.updateAvailable")
      : fmtBytes(region.size);

  return (
    <View>
      <Row title={region.name[lang] ?? region.name.cs} subtitle={subtitle} right={right} last={last && !dl} />
      {dl && (
        <View style={{ paddingBottom: space.sm }}>
          <ProgressBar value={dl.bytes / Math.max(1, dl.total)} color={dl.state === "error" ? colors.stop : dl.state === "paused" ? colors.warn : colors.go} />
        </View>
      )}
    </View>
  );
}

function PickMap({ kind, regions, selected, onSelect }: { kind: RegionKind; regions: CatalogRegion[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const lang = useLang();
  const downloaded = useOffline((s) => s.downloaded);
  const catalog = useOffline((s) => s.catalog);
  const style = useMemo(
    () =>
      buildStyle({
        styleId: "enduro",
        sources: resolveSources({ region: null, online: true, preferOffline: false, catalog }).sources,
        glyphs: glyphsUrl(),
        lang,
        textScale: 0.9,
      }),
    [catalog, lang],
  );
  const ofKind = useMemo(() => regions.filter((r) => r.kind === kind), [regions, kind]);
  const polygonsUrl = dataUrl("regions.geojson");
  // Real boundaries come from the data server; bbox rectangles are the fallback.
  const data = useMemo<string | GeoJSON.FeatureCollection>(
    () =>
      polygonsUrl ?? {
        type: "FeatureCollection",
        features: regions.map((r) => {
          const [w, s, e, n] = r.bbox;
          return {
            type: "Feature",
            id: r.id,
            properties: { id: r.id, kind: r.kind, name_cs: r.name.cs, name_en: r.name.en },
            geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
          };
        }),
      },
    [polygonsUrl, regions],
  );
  const haveIds = useMemo(() => downloaded.map((d) => d.id), [downloaded]);
  const isSel: unknown = ["==", ["get", "id"], selected ?? ""];
  const isHave: unknown = ["in", ["get", "id"], ["literal", haveIds]];
  const kindFilter: unknown = ["==", ["get", "kind"], kind];
  const center = ofKind[0]?.center ?? DEFAULT_CENTER;
  const map = useRef<MapRef>(null);

  const onPress = async (e: NativeSyntheticEvent<PressEvent>) => {
    const [lon, lat] = e.nativeEvent.lngLat;
    const { point } = e.nativeEvent;
    haptic.tap();
    const feats = await map.current?.queryRenderedFeatures(point, { layers: ["regions-fill"] }).catch(() => []);
    const hit = feats?.find((f) => f.properties?.kind === kind)?.properties?.id as string | undefined;
    if (hit) {
      onSelect(hit);
      return;
    }
    const inBox = ofKind
      .filter((r) => inBbox([lon, lat], r.bbox))
      .sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]));
    onSelect(inBox[0]?.id ?? null);
  };

  return (
    <View style={styles.mapWrap}>
      <Map ref={map} style={StyleSheet.absoluteFill} mapStyle={style} onPress={onPress} logo={false} attribution={false} compass={false}>
        <Camera initialViewState={{ center, zoom: kind === "country" ? 4.5 : 6.2 }} />
        <GeoJSONSource id="regions" data={data}>
          <Layer
            id="regions-fill"
            type="fill"
            filter={kindFilter as never}
            paint={{
              "fill-color": ["case", isSel, colors.route, isHave, colors.go, "#FFFFFF"] as never,
              "fill-opacity": ["case", isSel, 0.35, isHave, 0.2, 0.04] as never,
            }}
          />
          <Layer
            id="regions-line"
            type="line"
            filter={kindFilter as never}
            paint={{
              "line-color": ["case", isSel, colors.route, isHave, colors.go, "#8A96A6"] as never,
              "line-width": ["case", isSel, 2.5, 1] as never,
            }}
          />
          <Layer
            id="regions-label"
            type="symbol"
            filter={kindFilter as never}
            layout={{
              "text-field": ["get", lang === "en" ? "name_en" : "name_cs"] as never,
              "text-font": ["Noto Sans Bold"],
              "text-size": 12,
            }}
            paint={{ "text-color": "#E8EDF3", "text-halo-color": "#0B0E13", "text-halo-width": 1.5 }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

export default function OfflineScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const catalog = useOffline((s) => s.catalog);
  const loading = useOffline((s) => s.catalogLoading);
  const catalogError = useOffline((s) => s.catalogError);
  const downloaded = useOffline((s) => s.downloaded);
  const preferOffline = useSettings((s) => s.preferOffline);
  const [mode, setMode] = useState<"list" | "map">("list");
  const [kind, setKind] = useState<RegionKind>("region");
  const [selected, setSelected] = useState<string | null>(null);
  const [space_, setSpace] = useState(freeSpace());

  useEffect(() => {
    useOffline.getState().loadCatalog();
    useOffline.getState().refreshDownloaded();
  }, []);
  useEffect(() => setSpace(freeSpace()), [downloaded]);

  const regions = catalog?.regions ?? [];
  const byKind = useMemo(
    () => regions.filter((r) => r.kind === kind).sort((a, b) => a.name.cs.localeCompare(b.name.cs, "cs")),
    [regions, kind],
  );
  const selectedRegion = regions.find((r) => r.id === selected) ?? null;

  const remove = (id: string, name: string) => {
    Alert.alert(t("offline.deleteConfirm", { name }), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => deleteRegion(id) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }}>
      <Card>
        <SwitchRow
          title={t("offline.useOffline")}
          subtitle={t("offline.useOfflineHint")}
          value={preferOffline}
          onChange={(v) => useSettings.getState().set("preferOffline", v)}
        />
        <Row
          title={t("offline.freeSpace", { size: Number.isFinite(space_) ? fmtBytes(space_) : "?" })}
          subtitle={t("offline.includes")}
          last
        />
      </Card>

      {downloaded.length > 0 && (
        <>
          <SectionTitle>{t("offline.downloaded")}</SectionTitle>
          <Card>
            {downloaded.map((d, i) => {
              const cat = regions.find((r) => r.id === d.id);
              const outdated = cat && cat.version !== d.version;
              return (
                <Row
                  key={d.id}
                  title={d.name}
                  subtitle={`${fmtBytes(d.size)} · ${fmtDate(d.downloaded_at)}${outdated ? ` · ${t("offline.updateAvailable")}` : ""}`}
                  last={i === downloaded.length - 1}
                  right={
                    <View style={styles.rowBtns}>
                      {outdated && cat && (
                        <Touch onPress={() => start(cat)} style={styles.iconBtn}>
                          <ArrowClockwise size={18} color={colors.warn} weight="bold" />
                        </Touch>
                      )}
                      <Touch onPress={() => remove(d.id, d.name)} style={styles.iconBtn}>
                        <Trash size={18} color={colors.stop} weight="bold" />
                      </Touch>
                    </View>
                  }
                />
              );
            })}
          </Card>
        </>
      )}

      <SectionTitle>{t("offline.available")}</SectionTitle>
      {!catalog ? (
        <Card style={{ padding: space.lg, gap: space.md }}>
          {loading ? (
            <ActivityIndicator color={colors.textDim} />
          ) : (
            <>
              <Text style={type.small}>{t("offline.noCatalog")}</Text>
              {catalogError ? <Text style={type.tiny}>{catalogError}</Text> : null}
              <Touch onPress={() => useOffline.getState().loadCatalog(true)} style={styles.retry}>
                <ArrowClockwise size={16} color={colors.route} weight="bold" />
                <Text style={[type.body, { color: colors.route, fontWeight: "700" }]}>{t("common.retry")}</Text>
              </Touch>
              <Text style={type.tiny}>{t("offline.online")}</Text>
            </>
          )}
        </Card>
      ) : (
        <>
          <Segmented
            options={[
              { value: "list", label: t("offline.list") },
              { value: "map", label: t("offline.pickOnMap") },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Segmented
            style={{ marginTop: space.sm }}
            options={KINDS.map((k) => ({ value: k, label: t(`offline.${k}`) }))}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setSelected(null);
            }}
          />
          {mode === "map" ? (
            <>
              <PickMap kind={kind} regions={regions} selected={selected} onSelect={setSelected} />
              {selectedRegion ? (
                <Card style={{ marginTop: space.md }}>
                  <RegionRow region={selectedRegion} last />
                </Card>
              ) : (
                <Text style={[type.small, { textAlign: "center", marginTop: space.md }]}>{t("offline.selectHint")}</Text>
              )}
            </>
          ) : (
            <Card style={{ marginTop: space.md }}>
              {byKind.map((r, i) => (
                <RegionRow key={r.id} region={r} last={i === byKind.length - 1} />
              ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.surface3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  rowBtns: { flexDirection: "row", gap: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
  dlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.route,
  },
  dlText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  retry: { flexDirection: "row", alignItems: "center", gap: space.sm },
  mapWrap: { height: 380, borderRadius: radius.lg, overflow: "hidden", marginTop: space.md, backgroundColor: colors.surface },
});
