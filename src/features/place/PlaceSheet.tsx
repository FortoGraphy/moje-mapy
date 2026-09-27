import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Linking, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BookmarkSimple,
  Clock,
  Info,
  MapPin,
  Path as PathIcon,
  Plus,
  ShareNetwork,
  Signpost,
  X,
} from "@/components/icons";
import { sheetProps, useSheetPosition } from "@/components/sheet";
import { BigButton, Touch, haptic } from "@/components/ui";
import { isPlaceSaved, removePlace, savePlace } from "@/db/places";
import { useT } from "@/i18n";
import { useLocation } from "@/location/store";
import { useRouting } from "@/routing/store";
import { PlaceIcon } from "@/features/search/PlaceIcon";
import { fetchOsmTags } from "@/search/overpass";
import { photonReverse } from "@/search/photon";
import { useUi } from "@/store/ui";
import { colors, radius, space, type } from "@/theme";
import type { Place } from "@/types";
import { fmtCoords, fmtDistance } from "@/utils/format";
import { bearing, haversine } from "@/utils/geo";
import { useOnline } from "@/utils/online";

function Action({ icon, label, onPress, active }: { icon: React.ReactNode; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Touch onPress={onPress} style={[styles.action, active ? { backgroundColor: colors.surface3 } : {}]}>
      {icon}
      <Text style={styles.actionText} numberOfLines={1}>
        {label}
      </Text>
    </Touch>
  );
}

function Detail({ icon, text, onPress }: { icon: React.ReactNode; text: string; onPress?: () => void }) {
  const body = (
    <View style={styles.detail}>
      {icon}
      <Text style={[type.body, { flex: 1 }, onPress && { color: colors.route }]} numberOfLines={3}>
        {text}
      </Text>
    </View>
  );
  return onPress ? <Touch onPress={onPress}>{body}</Touch> : body;
}

export function PlaceSheet() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const pos = useSheetPosition();
  const online = useOnline();
  const place = useUi((s) => s.place);
  const isPin = useUi((s) => s.droppedPin != null);
  const fix = useLocation((s) => s.fix);
  const [info, setInfo] = useState<Place | null>(null);
  const [tags, setTags] = useState<Record<string, string> | null>(null);
  const [saved, setSaved] = useState(false);
  const planning = useRouting((s) => s.points.length > 0);

  useEffect(() => {
    setInfo(null);
    setTags(place?.tags ?? null);
    setSaved(place ? isPlaceSaved(place.id) : false);
    if (!place || !online) return;
    const ctrl = new AbortController();
    if (isPin) {
      photonReverse(place.lon, place.lat, ctrl.signal)
        .then((r) => r && !ctrl.signal.aborted && setInfo(r))
        .catch(() => {});
    } else if (place.osmType && place.osmId && !place.tags) {
      fetchOsmTags(place.osmType, place.osmId, ctrl.signal)
        .then((r) => r && !ctrl.signal.aborted && setTags(r))
        .catch(() => {});
    }
    return () => ctrl.abort();
  }, [place, isPin, online]);

  if (!place) return null;

  const title = isPin && info ? info.name : place.name;
  const subtitle = isPin ? (info?.subtitle ?? t("map.droppedPin")) : place.subtitle;
  const effective: Place = isPin && info ? { ...place, name: info.name, subtitle: info.subtitle } : place;
  const dist = fix ? haversine([fix.lon, fix.lat], [place.lon, place.lat]) : null;
  const dir = fix ? bearing([fix.lon, fix.lat], [place.lon, place.lat]) : 0;

  const route = () => {
    haptic.impact();
    useRouting.getState().open(effective);
    useUi.setState({ place: null, droppedPin: null, panel: "planner" });
  };
  const addStop = () => {
    useRouting.getState().addStop(effective);
    useUi.setState({ place: null, droppedPin: null, panel: "planner" });
  };
  const toggleSave = () => {
    if (saved) removePlace(place.id);
    else savePlace(effective);
    haptic.success();
    setSaved(!saved);
  };
  const share = () => {
    const url = `https://www.openstreetmap.org/?mlat=${place.lat.toFixed(6)}&mlon=${place.lon.toFixed(6)}#map=17/${place.lat.toFixed(5)}/${place.lon.toFixed(5)}`;
    Share.share({ message: `${title}\n${fmtCoords(place.lon, place.lat)}\n${url}` });
  };

  const phone = tags?.phone ?? tags?.["contact:phone"];
  const website = tags?.website ?? tags?.["contact:website"];
  const hours = tags?.opening_hours;
  const ele = tags?.ele;

  return (
    <BottomSheet
      {...sheetProps}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={() => useUi.getState().clearPlace()}
      animatedPosition={pos ?? undefined}
    >
      <BottomSheetView style={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.lg }}>
        <View style={styles.head}>
          <PlaceIcon category={place.category} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={type.h2} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[type.small, { marginTop: 2 }]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
            {dist != null && (
              <View style={styles.distRow}>
                <View style={{ transform: [{ rotate: `${dir}deg` }] }}>
                  <Signpost size={14} color={colors.textDim} weight="fill" />
                </View>
                <Text style={type.small}>
                  {fmtDistance(dist)} {t("place.away")}
                </Text>
              </View>
            )}
          </View>
          <Touch onPress={() => useUi.getState().clearPlace()} style={styles.close}>
            <X size={18} color={colors.text} weight="bold" />
          </Touch>
        </View>

        <View style={styles.buttons}>
          <BigButton
            title={t("place.route")}
            color={colors.route}
            icon={<PathIcon size={22} color={colors.white} weight="bold" />}
            onPress={route}
            style={{ flex: 1 }}
          />
          {planning && (
            <BigButton
              title={t("place.addStop")}
              color={colors.surface3}
              icon={<Plus size={20} color={colors.text} weight="bold" />}
              onPress={addStop}
              textColor={colors.text}
              style={{ flex: 1 }}
            />
          )}
        </View>

        <View style={styles.actions}>
          <Action
            icon={<BookmarkSimple size={22} color={saved ? colors.warn : colors.text} weight={saved ? "fill" : "bold"} />}
            label={saved ? t("place.saved") : t("place.save")}
            onPress={toggleSave}
            active={saved}
          />
          <Action icon={<ShareNetwork size={22} color={colors.text} weight="bold" />} label={t("place.share")} onPress={share} />
          <Action
            icon={<MapPin size={22} color={colors.text} weight="bold" />}
            label={t("place.coords")}
            onPress={() => {
              Clipboard.setStringAsync(fmtCoords(place.lon, place.lat));
              haptic.success();
            }}
          />
        </View>

        {(hours || phone || website || ele) && (
          <View style={styles.details}>
            {ele ? <Detail icon={<Info size={18} color={colors.textDim} />} text={`${t("place.elevation")}: ${ele} m`} /> : null}
            {hours ? <Detail icon={<Clock size={18} color={colors.textDim} />} text={hours} /> : null}
            {phone ? (
              <Detail
                icon={<Info size={18} color={colors.textDim} />}
                text={phone}
                onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, "")}`)}
              />
            ) : null}
            {website ? (
              <Detail
                icon={<Info size={18} color={colors.textDim} />}
                text={website.replace(/^https?:\/\//, "")}
                onPress={() => Linking.openURL(website.startsWith("http") ? website : `https://${website}`)}
              />
            ) : null}
          </View>
        )}
        <Text style={[type.tiny, { marginTop: space.md }]}>{fmtCoords(place.lon, place.lat)}</Text>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", gap: space.md, alignItems: "flex-start", paddingTop: 4 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  buttons: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  action: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  actionText: { ...type.tiny, color: colors.text },
  details: { marginTop: space.md, backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: space.md },
  detail: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
});
