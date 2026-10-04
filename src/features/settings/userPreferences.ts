import type { Language, ThemeId, UserPreferences } from "../../shared/types";
import { defaultUserPreferences } from "../project/projectModel";

export const USER_PREFERENCES_KEY = "scriptarc.user-preferences.v1";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadUserPreferences(storage: PreferenceStorage = window.localStorage): UserPreferences {
  let serialized: string | null;
  try {
    serialized = storage.getItem(USER_PREFERENCES_KEY);
  } catch {
    return { ...defaultUserPreferences };
  }
  if (!serialized) return { ...defaultUserPreferences };
  try {
    const value: unknown = JSON.parse(serialized) as unknown;
    if (!isRecord(value)) throw new Error("Invalid preferences");
    const result: UserPreferences = {
      interfaceLanguage: isLanguage(value.interfaceLanguage) ? value.interfaceLanguage : defaultUserPreferences.interfaceLanguage,
      theme: isTheme(value.theme) ? value.theme : defaultUserPreferences.theme,
      defaultFontSize: boundedNumber(value.defaultFontSize, 30, 96, defaultUserPreferences.defaultFontSize),
      defaultWordsPerMinute: boundedNumber(value.defaultWordsPerMinute, 80, 240, defaultUserPreferences.defaultWordsPerMinute),
      defaultLanguage: isLanguage(value.defaultLanguage) ? value.defaultLanguage : defaultUserPreferences.defaultLanguage,
      countdownSeconds: [0, 3, 5, 10].includes(value.countdownSeconds as number)
        ? value.countdownSeconds as number
        : defaultUserPreferences.countdownSeconds,
      hideControlsAutomatically: typeof value.hideControlsAutomatically === "boolean"
        ? value.hideControlsAutomatically
        : defaultUserPreferences.hideControlsAutomatically,
    };
    return result;
  } catch {
    try { storage.removeItem(USER_PREFERENCES_KEY); } catch { /* Storage may be unavailable. */ }
    return { ...defaultUserPreferences };
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

function isTheme(value: unknown): value is ThemeId {
  return value === "white" || value === "gray" || value === "orange" || value === "blue" || value === "pink" || value === "black";
}
