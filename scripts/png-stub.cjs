// Lets Node load modules that `require()` image assets (used by scripts/validate-style.ts).
const Module = require("module");
Module._extensions[".png"] = (m) => {
  m.exports = 1;
};
