import type { LocationObject } from "expo-location";
import * as TaskManager from "expo-task-manager";

import { LOCATION_TASK } from "@/location/background";
import { ingestFix, locationToFix } from "@/location/store";

// Must be defined at module scope so iOS can deliver updates while the app is in the background.
// The recorder and navigation engine subscribe to the location store, so feeding it is enough.
TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations) return;
  for (const l of data.locations) ingestFix(locationToFix(l));
});
