// expo-sqlite's web worker cannot start while the main thread is blocked by a synchronous query,
// and the app opens its databases synchronously at import time. Start the worker first.
import { openDatabaseAsync } from "expo-sqlite";

openDatabaseAsync("mojemapy.db")
  .catch((err) => console.warn("SQLite warm-up failed", err))
  .finally(() => require("expo-router/entry"));
