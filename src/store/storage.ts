import Storage from "expo-sqlite/kv-store";
import { AppState } from "react-native";
import { createJSONStorage } from "zustand/middleware";

// Some persisted state (trip meters) changes on every GPS fix; a synchronous SQLite write per fix
// blocks the JS thread, so writes are coalesced and flushed periodically and when the app leaves the foreground.
const WRITE_DELAY = 15_000;
const pending: Record<string, string> = {};
let timer: ReturnType<typeof setTimeout> | null = null;

export function flushStorage() {
  if (timer) clearTimeout(timer);
  timer = null;
  for (const key of Object.keys(pending)) {
    const value = pending[key];
    delete pending[key];
    try {
      Storage.setItemSync(key, value);
    } catch (e) {
      console.warn("storage flush", key, e);
    }
  }
}

AppState.addEventListener("change", (s) => {
  if (s !== "active") flushStorage();
});

export const kvStorage = createJSONStorage(() => ({
  getItem: (key: string) => pending[key] ?? Storage.getItemSync(key),
  setItem: (key: string, value: string) => {
    pending[key] = value;
    timer ??= setTimeout(flushStorage, WRITE_DELAY);
  },
  removeItem: (key: string) => {
    delete pending[key];
    Storage.removeItemSync(key);
  },
}));
