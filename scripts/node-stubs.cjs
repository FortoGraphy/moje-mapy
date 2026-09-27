// Minimal stand-ins for native modules so app logic can be exercised from Node scripts.
const Module = require("module");
const path = require("path");

const mem = new Map();
const noop = () => {};
const asyncNoop = async () => {};
const Component = () => null;

global.__speech = [];

const stubs = {
  "expo-sqlite/kv-store": {
    Storage: {
      getItemSync: (k) => mem.get(k) ?? null,
      setItemSync: (k, v) => mem.set(k, v),
      removeItemSync: (k) => mem.delete(k),
    },
  },
  "expo-localization": { getLocales: () => [{ languageCode: "cs" }] },
  "expo-haptics": {
    selectionAsync: asyncNoop,
    impactAsync: asyncNoop,
    notificationAsync: asyncNoop,
    ImpactFeedbackStyle: {},
    NotificationFeedbackType: {},
  },
  "expo-keep-awake": { activateKeepAwakeAsync: asyncNoop, deactivateKeepAwake: noop },
  "expo-speech": { speak: (text) => global.__speech.push(text), stop: noop },
  "expo-network": {
    getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
    addNetworkStateListener: () => ({ remove: noop }),
  },
  "expo-location": {
    Accuracy: {},
    ActivityType: {},
    getBackgroundPermissionsAsync: async () => ({ status: "denied", canAskAgain: false }),
    hasStartedLocationUpdatesAsync: async () => false,
  },
  "react-native": {
    Platform: { OS: "ios", select: (o) => o.ios ?? o.default },
    StyleSheet: { create: (s) => s, hairlineWidth: 0.5, absoluteFill: {} },
    Pressable: Component,
    Switch: Component,
    Text: Component,
    View: Component,
  },
  "@maplibre/maplibre-react-native": {},
  "expo-file-system": { File: class {}, Directory: class {}, Paths: {} },
  "expo-sharing": { shareAsync: asyncNoop },
};

const isStub = (r) => r in stubs || r.startsWith("phosphor-react-native");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (isStub(request)) return `stub:${request}`;
  return origResolve.call(this, request, ...rest);
};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request in stubs) return stubs[request];
  if (request.startsWith("phosphor-react-native")) return {};
  return origLoad.call(this, request, ...rest);
};

Module._extensions[".png"] = (m) => {
  m.exports = 1;
};
module.exports = { root: path.resolve(__dirname, "..") };
