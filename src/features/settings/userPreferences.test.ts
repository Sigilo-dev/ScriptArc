import { describe, expect, it } from "vitest";
import { defaultUserPreferences } from "../project/projectModel";
import { loadUserPreferences, saveUserPreferences, USER_PREFERENCES_KEY } from "./userPreferences";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe("user preferences", () => {
  it("stores and reloads separate validated preferences", () => {
    const storage = new MemoryStorage();
    const settings = {
      ...defaultUserPreferences,
      interfaceLanguage: "en" as const,
      theme: "blue" as const,
      countdownSeconds: 3,
      hideControlsAutomatically: false,
    };
    saveUserPreferences(settings, storage);
    expect(storage.getItem(USER_PREFERENCES_KEY)).toContain('"theme":"blue"');
    expect(loadUserPreferences(storage)).toEqual(settings);
  });

  it("persists a custom theme palette and falls back when any stored color is invalid", () => {
    const storage = new MemoryStorage();
    const settings = {
      ...defaultUserPreferences,
      theme: "custom" as const,
      customPaletteInitialized: true,
      customPalette: { ...defaultUserPreferences.customPalette, accent: "#123abc" },
    };
    saveUserPreferences(settings, storage);
    expect(loadUserPreferences(storage)).toEqual(settings);

    storage.setItem(USER_PREFERENCES_KEY, JSON.stringify({
      theme: "custom",
      customPalette: { ...settings.customPalette, accent: "url(javascript:alert(1))" },
    }));
    expect(loadUserPreferences(storage).customPalette).toEqual(defaultUserPreferences.customPalette);
  });

  it("defaults the interface to Spanish and rejects an unsupported interface language", () => {
    const storage = new MemoryStorage();
    expect(loadUserPreferences(storage).interfaceLanguage).toBe("es");
    storage.setItem(USER_PREFERENCES_KEY, JSON.stringify({ interfaceLanguage: "fr" }));
    expect(loadUserPreferences(storage).interfaceLanguage).toBe("es");
  });

  it("resets corrupt values and clamps well-formed but out of range preferences", () => {
    const storage = new MemoryStorage();
    storage.setItem(USER_PREFERENCES_KEY, "invalid");
    expect(loadUserPreferences(storage)).toEqual(defaultUserPreferences);
    storage.setItem(USER_PREFERENCES_KEY, JSON.stringify({ defaultFontSize: 999, defaultWordsPerMinute: 1 }));
    expect(loadUserPreferences(storage)).toMatchObject({ defaultFontSize: 96, defaultWordsPerMinute: 80 });
  });
});
