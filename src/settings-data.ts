// Reads app embed state out of a theme's config/settings_data.json.
// Format: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#detecting-app-embed-blocks

export interface EmbedMatch {
  /** Liquid filename of the embed block without `.liquid`, e.g. `app-embed`. */
  blockHandle: string;
  /** App handle as it appears in the block type. Omit to match any app. */
  appHandle?: string;
}

export interface EmbedBlock {
  /** Key of the entry under `current.blocks`. */
  key: string;
  type: string;
  appHandle: string;
  blockHandle: string;
  extensionId: string;
  disabled: boolean;
}

export type EmbedState = "enabled" | "disabled" | "missing";

export class SettingsDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsDataError";
  }
}

const BLOCK_TYPE = /^shopify:\/\/apps\/([^/]+)\/blocks\/([^/]+)\/([^/]+)$/;

/**
 * Removes `/* *\/` and `//` comments outside of strings. Shopify writes a
 * comment header at the top of settings_data.json, and block types contain
 * `//` inside strings, so a plain regex would corrupt the file.
 */
export function stripJsonComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      const start = i;
      i++;
      while (i < text.length && text[i] !== '"') {
        i += text[i] === "\\" ? 2 : 1;
      }
      i++;
      out += text.slice(start, i);
    } else if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end === -1) throw new SettingsDataError("Unterminated comment in settings_data.json");
      i = end + 2;
    } else if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

export function parseSettingsData(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonComments(text));
  } catch (err) {
    if (err instanceof SettingsDataError) throw err;
    throw new SettingsDataError(`settings_data.json is not valid JSON: ${(err as Error).message}`);
  }
  if (!isObject(parsed)) throw new SettingsDataError("settings_data.json is not a JSON object");
  return parsed;
}

/**
 * Returns the active settings. `current` is usually an object, but a theme
 * that has never been customised can store a preset name instead.
 */
export function currentSettings(data: Record<string, unknown>): Record<string, unknown> {
  const current = data.current;
  if (isObject(current)) return current;
  if (typeof current === "string") {
    const presets = data.presets;
    const preset = isObject(presets) ? presets[current] : undefined;
    if (isObject(preset)) return preset;
    throw new SettingsDataError(`settings_data.json current points to missing preset "${current}"`);
  }
  throw new SettingsDataError("settings_data.json has no current settings");
}

export function findEmbedBlocks(data: Record<string, unknown>, match: EmbedMatch): EmbedBlock[] {
  const blocks = currentSettings(data).blocks;
  if (!isObject(blocks)) return [];

  const found: EmbedBlock[] = [];
  for (const [key, block] of Object.entries(blocks)) {
    if (!isObject(block) || typeof block.type !== "string") continue;
    const m = BLOCK_TYPE.exec(block.type);
    if (!m) continue;
    const [, appHandle, blockHandle, extensionId] = m as unknown as [string, string, string, string];
    if (blockHandle !== match.blockHandle) continue;
    if (match.appHandle !== undefined && appHandle !== match.appHandle) continue;
    found.push({ key, type: block.type, appHandle, blockHandle, extensionId, disabled: block.disabled === true });
  }
  return found;
}

/**
 * An entry only appears after the merchant first turns the embed on. Turning
 * it off later keeps the entry and sets `disabled: true`.
 */
export function embedState(data: Record<string, unknown>, match: EmbedMatch): EmbedState {
  const blocks = findEmbedBlocks(data, match);
  if (blocks.length === 0) return "missing";
  return blocks.some((b) => !b.disabled) ? "enabled" : "disabled";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
