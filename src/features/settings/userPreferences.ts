import type { CustomTheme, Language, PresetThemeId, ThemeId, ThemePalette, UserPreferences } from "../../shared/types";
import { defaultUserPreferences } from "../project/projectModel";
import { isPresetThemeId } from "./themes";

export const USER_PREFERENCES_KEY = "scriptarc.user-preferences.v1";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadUserPreferences(storage: PreferenceStorage = window.localStorage): UserPreferences {
  let serialized: string | null;
  try {
    serialized = storage.getItem(USER_PREFERENCES_KEY);
  } catch {
    return { ...defaultUserPreferences, customThemes: [] };
  }
  if (!serialized) return { ...defaultUserPreferences, customThemes: [] };
  try {
    const value: unknown = JSON.parse(serialized) as unknown;
    if (!isRecord(value)) throw new Error("Invalid preferences");
    const interfaceLanguage = isLanguage(value.interfaceLanguage) ? value.interfaceLanguage : defaultUserPreferences.interfaceLanguage;
    const customThemes = readCustomThemes(value.customThemes);

    // Migrate the previous single-custom-palette preference without losing the user's colors.
    if ((value.theme === "custom" || value.customPaletteInitialized === true)
      && !customThemes.some(({ id }) => id === "legacy-custom")) {
      const palette = readThemePalette(value.customPalette);
      if (palette) {
        customThemes.push({
          id: "legacy-custom",
          name: interfaceLanguage === "en" ? "Custom theme" : "Tema personalizado",
          baseTheme: "white",
          palette,
        });
      }
    }

    return {
      interfaceLanguage,
      theme: resolveTheme(value.theme, customThemes),
      customThemes,
      defaultFontSize: boundedNumber(value.defaultFontSize, 30, 96, defaultUserPreferences.defaultFontSize),
      defaultWordsPerMinute: boundedNumber(value.defaultWordsPerMinute, 80, 240, defaultUserPreferences.defaultWordsPerMinute),
      defaultLanguage: isLanguage(value.defaultLanguage) ? value.defaultLanguage : defaultUserPreferences.defaultLanguage,
      countdownSeconds: [0, 3, 5, 10].includes(value.countdownSeconds as number)
        ? value.countdownSeconds as number
        : defaultUserPreferences.countdownSeconds,
      playbackCountdownEnabled: typeof value.playbackCountdownEnabled === "boolean"
        ? value.playbackCountdownEnabled
        : defaultUserPreferences.playbackCountdownEnabled,
      playbackCountdownSeconds: Number.isInteger(value.playbackCountdownSeconds)
        ? Math.max(1, Math.min(10, value.playbackCountdownSeconds as number))
        : defaultUserPreferences.playbackCountdownSeconds,
      hideControlsAutomatically: typeof value.hideControlsAutomatically === "boolean"
        ? value.hideControlsAutomatically
        : defaultUserPreferences.hideControlsAutomatically,
    };
  } catch {
    try { storage.removeItem(USER_PREFERENCES_KEY); } catch { /* Storage may be unavailable. */ }
    return { ...defaultUserPreferences, customThemes: [] };
  }
}

export function saveUserPreferences(preferences: UserPreferences, storage: PreferenceStorage = window.localStorage): void {
  storage.setItem(USER_PREFERENCES_KEY, JSON.stringify(preferences));
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLanguage(value: unknown): value is Language {
  return value === "es" || value === "en";
}

function resolveTheme(value: unknown, customThemes: CustomTheme[]): ThemeId {
  if (typeof value === "string" && isPresetThemeId(value)) return value;
  if (value === "custom" && customThemes.some(({ id }) => id === "legacy-custom")) return "custom:legacy-custom";
  if (typeof value === "string" && value.startsWith("custom:")) {
    const id = value.slice("custom:".length);
    if (customThemes.some((theme) => theme.id === id)) return `custom:${id}`;
  }
  return defaultUserPreferences.theme;
}

const THEME_PALETTE_KEYS: readonly (keyof ThemePalette)[] = [
  "surface", "surfaceMuted", "text", "textSoft", "line", "accent", "accentSoft",
  "prompterBg", "prompterMuted", "prompterTextColor", "prompterCurrentColor", "prompterSpokenColor",
];

function readThemePalette(value: unknown): ThemePalette | null {
  if (!isRecord(value)) return null;
  const result = {} as ThemePalette;
  for (const key of THEME_PALETTE_KEYS) {
    const color = value[key];
    if (typeof color !== "string" || !/^#[\da-f]{6}$/iu.test(color)) return null;
    result[key] = color;
  }
  return result;
}

function readCustomThemes(value: unknown): CustomTheme[] {
  if (!Array.isArray(value)) return [];
  const themes: CustomTheme[] = [];
  const seen = new Set<string>();
  for (const candidate of value.slice(0, 100)) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || !/^[\w-]{1,80}$/u.test(candidate.id)
      || seen.has(candidate.id) || typeof candidate.name !== "string" || !candidate.name.trim()
      || candidate.name.length > 60 || typeof candidate.baseTheme !== "string" || !isPresetThemeId(candidate.baseTheme)) continue;
    const palette = readThemePalette(candidate.palette);
    if (!palette) continue;
    themes.push({
      id: candidate.id,
      name: candidate.name.trim(),
      baseTheme: candidate.baseTheme as PresetThemeId,
      palette,
    });
    seen.add(candidate.id);
  }
  return themes;
}
