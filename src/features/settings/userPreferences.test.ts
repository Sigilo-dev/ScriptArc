import { describe, expect, it } from "vitest";
import { defaultUserPreferences } from "../project/projectModel";
import { THEME_PALETTES } from "./themes";
import { loadUserPreferences, saveUserPreferences, USER_PREFERENCES_KEY } from "./userPreferences";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe("user preferences", () => {
  it("stores and reloads validated preferences and multiple custom themes", () => {
    const storage = new MemoryStorage();
    const settings = {
      ...defaultUserPreferences,
      interfaceLanguage: "en" as const,
      theme: "custom:night" as const,
      customThemes: [
        { id: "night", name: "Night", baseTheme: "black" as const, palette: { ...THEME_PALETTES.black, accent: "#123abc" } },
        { id: "sunset", name: "Sunset", baseTheme: "orange" as const, palette: { ...THEME_PALETTES.orange } },
      ],
      countdownSeconds: 3,
      playbackCountdownEnabled: true,
      playbackCountdownSeconds: 7,
      hideControlsAutomatically: false,
    };
    saveUserPreferences(settings, storage);
    expect(storage.getItem(USER_PREFERENCES_KEY)).toContain('"theme":"custom:night"');
    expect(loadUserPreferences(storage)).toEqual(settings);
  });

  it("migrates the former single custom palette into a named theme", () => {
    const storage = new MemoryStorage();
    const legacyPalette = { ...THEME_PALETTES.white, accent: "#123abc" };
    storage.setItem(USER_PREFERENCES_KEY, JSON.stringify({ theme: "custom", customPalette: legacyPalette }));
    expect(loadUserPreferences(storage)).toMatchObject({
      theme: "custom:legacy-custom",
      customThemes: [{ id: "legacy-custom", baseTheme: "white", palette: legacyPalette }],
    });
  });

  it("ignores invalid custom themes and does not select a missing theme", () => {
    const storage = new MemoryStorage();
    storage.setItem(USER_PREFERENCES_KEY, JSON.stringify({
      theme: "custom:bad",
      customThemes: [{ id: "bad", name: "Bad", baseTheme: "white", palette: { ...THEME_PALETTES.white, accent: "url(javascript:alert(1))" } }],
    }));
    expect(loadUserPreferences(storage).theme).toBe("white");
    expect(loadUserPreferences(storage).customThemes).toEqual([]);
  });

  it("defaults the interface to Spanish and rejects an unsupported interface language", () => {
    const storage = new MemoryStorage();
    expect(loadUserPreferences(storage).interfaceLanguage).toBe("es");
    storage.setItem(USER_PREFERENCES_KEY, JSON.stringify({ interfaceLanguage: "fr" }));
    expect(loadUserPreferences(storage).interfaceLanguage).toBe("es");
  });

  it("defaults playback countdown off and clamps a configured duration to one through ten", () => {
    const storage = new MemoryStorage();
    expect(loadUserPreferences(storage)).toMatchObject({ playbackCountdownEnabled: false, playbackCountdownSeconds: 5 });
    storage.setItem(USER_PREFERENCES_KEY, JSON.stringify({ playbackCountdownEnabled: true, playbackCountdownSeconds: 50 }));
    expect(loadUserPreferences(storage)).toMatchObject({ playbackCountdownEnabled: true, playbackCountdownSeconds: 10 });
    storage.setItem(USER_PREFERENCES_KEY, JSON.stringify({ playbackCountdownSeconds: 0 }));
    expect(loadUserPreferences(storage).playbackCountdownSeconds).toBe(1);
  });

  it("resets corrupt values and clamps well-formed preferences", () => {
    const storage = new MemoryStorage();
    storage.setItem(USER_PREFERENCES_KEY, "invalid");
    expect(loadUserPreferences(storage)).toEqual(defaultUserPreferences);
    storage.setItem(USER_PREFERENCES_KEY, JSON.stringify({ defaultFontSize: 999, defaultWordsPerMinute: 1 }));
    expect(loadUserPreferences(storage)).toMatchObject({ defaultFontSize: 96, defaultWordsPerMinute: 80 });
  });
});
