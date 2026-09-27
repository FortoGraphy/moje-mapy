import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";

import { GLYPH_FILES } from "./glyphs.generated";

const VERSION = "1";
const root = new Directory(Paths.document, "glyphs");

/**
 * MapLibre substitutes {fontstack} either raw or percent-encoded depending on the file source,
 * so the glyphs are installed under both directory spellings.
 */
export async function installGlyphs(): Promise<void> {
  const marker = new File(root, `.v${VERSION}`);
  if (marker.exists) return;
  root.create({ intermediates: true, idempotent: true });
  for (const g of GLYPH_FILES) {
    const asset = Asset.fromModule(g.asset);
    await asset.downloadAsync();
    if (!asset.localUri) continue;
    const src = new File(asset.localUri);
    for (const dirName of [g.font, encodeURIComponent(g.font)]) {
      const dir = new Directory(root, dirName);
      dir.create({ intermediates: true, idempotent: true });
      const dest = new File(dir, `${g.range}.pbf`);
      if (dest.exists) dest.delete();
      await src.copy(dest);
    }
  }
  marker.create({ overwrite: true });
}

export function glyphsUrl(): string {
  return `${root.uri.replace(/\/$/, "")}/{fontstack}/{range}.pbf`;
}
