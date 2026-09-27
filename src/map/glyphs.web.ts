export async function installGlyphs(): Promise<void> {}

export function glyphsUrl(): string {
  return "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
}
