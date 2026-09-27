const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("pbf", "wasm");

// Browser preview only: MapLibre React Native has no web implementation.
const mapShim = path.resolve(__dirname, "src/web/maplibre-shim.tsx");
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "@maplibre/maplibre-react-native") {
    return { type: "sourceFile", filePath: mapShim };
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

// expo-sqlite on web needs SharedArrayBuffer.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  middleware(req, res, next);
};

module.exports = config;
