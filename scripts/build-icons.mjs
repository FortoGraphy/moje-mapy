// Generates the map icon set (our own Waze-like badges built from CC0 Maki glyph shapes)
// and the app icon. Output: assets/map-icons/*.png (@1x/@2x/@3x) + src/map/icons.generated.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const makiDir = path.join(root, "node_modules/@mapbox/maki/icons");
const outDir = path.join(root, "assets/map-icons");
fs.mkdirSync(outDir, { recursive: true });

const CAT = {
  fuel: "#FF8A00",
  moto: "#E4002B",
  food: "#FF5A5F",
  shop: "#8B5CF6",
  lodging: "#3B82F6",
  nature: "#22A559",
  culture: "#B7791F",
  health: "#EF4444",
  transport: "#0EA5E9",
  services: "#64748B",
  sport: "#14B8A6",
};

// OpenMapTiles poi class -> [maki glyph, category]
const POI = {
  fuel: ["fuel", "fuel"],
  charging_station: ["charging-station", "fuel"],
  car: ["car-repair", "moto"],
  motorcycle: ["scooter", "moto"],
  restaurant: ["restaurant", "food"],
  fast_food: ["fast-food", "food"],
  cafe: ["cafe", "food"],
  bar: ["bar", "food"],
  beer: ["beer", "food"],
  ice_cream: ["ice-cream", "food"],
  bakery: ["bakery", "food"],
  shop: ["shop", "shop"],
  grocery: ["grocery", "shop"],
  alcohol_shop: ["alcohol-shop", "shop"],
  clothing_store: ["clothing-store", "shop"],
  hardware: ["hardware", "shop"],
  furniture: ["furniture", "shop"],
  jewelry: ["jewelry-store", "shop"],
  shoe: ["shoe", "shop"],
  books: ["library", "shop"],
  gift: ["gift", "shop"],
  music: ["music", "shop"],
  mobile_phone: ["mobile-phone", "shop"],
  laundry: ["laundry", "services"],
  lodging: ["lodging", "lodging"],
  campsite: ["campsite", "lodging"],
  shelter: ["shelter", "lodging"],
  park: ["park", "nature"],
  garden: ["garden", "nature"],
  viewpoint: ["viewpoint", "nature"],
  drinking_water: ["drinking-water", "nature"],
  picnic_site: ["picnic-site", "nature"],
  attraction: ["attraction", "culture"],
  art_gallery: ["art-gallery", "culture"],
  museum: ["museum", "culture"],
  castle: ["castle", "culture"],
  monument: ["monument", "culture"],
  place_of_worship: ["place-of-worship", "culture"],
  theatre: ["theatre", "culture"],
  cinema: ["cinema", "culture"],
  zoo: ["zoo", "culture"],
  hospital: ["hospital", "health"],
  doctors: ["doctor", "health"],
  pharmacy: ["pharmacy", "health"],
  dentist: ["dentist", "health"],
  veterinary: ["veterinary", "health"],
  bus: ["bus", "transport"],
  railway: ["rail", "transport"],
  parking: ["parking", "transport"],
  bicycle_parking: ["bicycle", "transport"],
  bicycle_rental: ["bicycle-share", "transport"],
  ferry_terminal: ["ferry", "transport"],
  aerialway: ["aerialway", "transport"],
  police: ["police", "services"],
  fire_station: ["fire-station", "services"],
  post: ["post", "services"],
  bank: ["bank", "services"],
  atm: ["bank", "services"],
  toilets: ["toilet", "services"],
  town_hall: ["town-hall", "services"],
  library: ["library", "services"],
  school: ["school", "services"],
  college: ["college", "services"],
  information: ["information", "services"],
  stadium: ["stadium", "sport"],
  pitch: ["pitch", "sport"],
  sports_centre: ["fitness-centre", "sport"],
  swimming_pool: ["swimming", "sport"],
  golf: ["golf", "sport"],
  playground: ["playground", "sport"],
};

function makiInner(name) {
  const svg = fs.readFileSync(path.join(makiDir, `${name}.svg`), "utf8");
  return svg.replace(/<\?xml[^>]*>/, "").replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim();
}

const shadow = `<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0.8" stdDeviation="0.9" flood-color="#000" flood-opacity="0.55"/></filter>`;

function badge(glyph, color, { size = 28, r = 11, glyphScale = 0.95 } = {}) {
  const g = 15 * glyphScale;
  const off = (size - g) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>${shadow}</defs>
<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${color}" stroke="#FFFFFF" stroke-width="1.8" filter="url(#s)"/>
<g transform="translate(${off} ${off}) scale(${glyphScale})" fill="#FFFFFF">${makiInner(glyph)}</g>
</svg>`;
}

function pin(color, inner = `<circle cx="14" cy="13" r="4" fill="#FFFFFF"/>`) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
<defs>${shadow}</defs>
<path d="M14 36 C14 36 3 22.5 3 13.5 A11 11 0 0 1 25 13.5 C25 22.5 14 36 14 36 Z" fill="${color}" stroke="#FFFFFF" stroke-width="2" filter="url(#s)"/>
${inner}
</svg>`;
}

const EXTRA = {
  "poi-default": badge("marker", "#64748B"),
  "poi-peak": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="16" viewBox="0 0 18 16"><defs>${shadow}</defs><path d="M9 2 L16.5 14 H1.5 Z" fill="#8B5A2B" stroke="#FFE7C2" stroke-width="1.4" stroke-linejoin="round" filter="url(#s)"/></svg>`,
  "poi-volcano": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="16" viewBox="0 0 18 16"><path d="M9 2 L16.5 14 H1.5 Z" fill="#6B4423" stroke="#FFE7C2" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
  "pin-start": `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><defs>${shadow}</defs><circle cx="13" cy="13" r="9.5" fill="#1FCB6B" stroke="#FFFFFF" stroke-width="3" filter="url(#s)"/><circle cx="13" cy="13" r="3" fill="#FFFFFF"/></svg>`,
  "pin-stop": `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><defs>${shadow}</defs><circle cx="14" cy="14" r="11" fill="#3D8BFF" stroke="#FFFFFF" stroke-width="2.5" filter="url(#s)"/></svg>`,
  "pin-end": pin("#FF3B4E", `<path d="M9.5 8.5 H18.5 L16.5 11.5 L18.5 14.5 H11 V18.5 H9.5 Z" fill="#FFFFFF"/>`),
  "pin-dropped": pin("#E4002B"),
  "pin-search": pin("#3D8BFF"),
  "pin-photo": badge("attraction", "#FF8A00", { size: 28, r: 11.5 }),
  "pin-waypoint": badge("star", "#FF8A00", { size: 28, r: 11.5 }),
  "route-arrow": `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path d="M3 2 L9 6 L3 10" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "ride-start": `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="#1FCB6B" stroke="#FFFFFF" stroke-width="2.5"/></svg>`,
  "ride-end": `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="3" fill="#FF3B4E" stroke="#FFFFFF" stroke-width="2.5"/></svg>`,
};

async function render(name, svg) {
  for (const [scale, suffix] of [[1, ""], [2, "@2x"], [3, "@3x"]]) {
    await sharp(Buffer.from(svg), { density: 72 * scale }).png().toFile(path.join(outDir, `${name}${suffix}.png`));
  }
}

const names = [];
for (const [cls, [glyph, cat]] of Object.entries(POI)) {
  await render(`poi-${cls}`, badge(glyph, CAT[cat]));
  names.push(`poi-${cls}`);
}
for (const [name, svg] of Object.entries(EXTRA)) {
  await render(name, svg);
  names.push(name);
}

const ts = `// Generated by scripts/build-icons.mjs – do not edit.
/* eslint-disable */
export const MAP_ICONS = {
${names.map((n) => `  "${n}": require("../../assets/map-icons/${n}.png"),`).join("\n")}
} as const;

export const POI_ICON_CLASSES: string[] = ${JSON.stringify(Object.keys(POI))};
`;
fs.writeFileSync(path.join(root, "src/map/icons.generated.ts"), ts);

// App icon + splash
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B222C"/><stop offset="1" stop-color="#07090C"/></linearGradient>
  <linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A4656"/><stop offset="1" stop-color="#1A212B"/></linearGradient>
</defs>
<rect width="1024" height="1024" fill="url(#bg)"/>
<path d="M0 760 L260 430 L400 590 L590 300 L1024 820 L1024 1024 L0 1024 Z" fill="url(#mt)"/>
<path d="M590 300 L665 390 L620 380 L590 420 L555 370 L520 385 Z" fill="#E9EEF4" opacity="0.9"/>
<path d="M120 960 C 300 860, 260 760, 450 720 S 700 640, 640 520" fill="none" stroke="#FFB020" stroke-width="30" stroke-linecap="round" stroke-dasharray="1 62"/>
<g transform="translate(640 190)">
  <path d="M0 330 C0 330 -150 150 -150 20 A150 150 0 0 1 150 20 C150 150 0 330 0 330 Z" fill="#E4002B" stroke="#FFFFFF" stroke-width="22"/>
  <circle cx="0" cy="20" r="58" fill="#FFFFFF"/>
</g>
</svg>`;
await sharp(Buffer.from(appIcon)).png().toFile(path.join(root, "assets/icon.png"));
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<g transform="translate(256 120)">
  <path d="M0 330 C0 330 -150 150 -150 20 A150 150 0 0 1 150 20 C150 150 0 330 0 330 Z" fill="#E4002B" stroke="#FFFFFF" stroke-width="18"/>
  <circle cx="0" cy="20" r="58" fill="#FFFFFF"/>
</g></svg>`;
await sharp(Buffer.from(splash)).png().toFile(path.join(root, "assets/splash-icon.png"));
await sharp(Buffer.from(splash)).resize(432, 432).png().toFile(path.join(root, "assets/android-icon-foreground.png"));

console.log(`icons: ${names.length} map icons + app icon`);
