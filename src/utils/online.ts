import * as Network from "expo-network";
import { useSyncExternalStore } from "react";

let online = true;
const listeners = new Set<() => void>();

function apply(s: Network.NetworkState) {
  const next = s.isConnected !== false && s.isInternetReachable !== false;
  if (next !== online) {
    online = next;
    listeners.forEach((l) => l());
  }
}

Network.getNetworkStateAsync().then(apply).catch(() => {});
Network.addNetworkStateListener(apply);

export function isOnline(): boolean {
  return online;
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => online,
  );
}
