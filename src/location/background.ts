import * as Location from "expo-location";

export const LOCATION_TASK = "moje-mapy-location";

/** Features currently needing background updates (recording, navigation). */
const holders = new Set<string>();

export async function hasBackgroundPermission(ask: boolean): Promise<boolean> {
  const cur = await Location.getBackgroundPermissionsAsync();
  if (cur.status === "granted") return true;
  if (!ask || !cur.canAskAgain) return false;
  return (await Location.requestBackgroundPermissionsAsync()).status === "granted";
}

/**
 * Starts background location updates (shared by recording and navigation). Resolves to false
 * when "Always" permission is missing; the foreground watcher then still works while the app is open.
 */
export async function acquireBackground(key: string): Promise<boolean> {
  holders.add(key);
  if (!(await hasBackgroundPermission(true))) return false;
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) return true;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0,
    activityType: Location.ActivityType.OtherNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Moje Mapy",
      notificationBody: "GPS",
      killServiceOnDestroy: false,
    },
  });
  return true;
}

export async function releaseBackground(key: string) {
  holders.delete(key);
  if (holders.size > 0) return;
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
  }
}
