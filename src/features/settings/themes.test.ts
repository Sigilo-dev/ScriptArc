import { describe, expect, it } from "vitest";
import { defaultUserPreferences } from "../project/projectModel";
import { isPresetThemeId, isThemeId, THEME_OPTIONS } from "./themes";

describe("themes", () => {
  it("provides six preset themes and starts with white", () => {
    expect(THEME_OPTIONS.map((theme) => theme.id))
      .toEqual(["white", "gray", "orange", "blue", "pink", "black"]);
    expect(defaultUserPreferences.theme).toBe("white");
    expect(isPresetThemeId("pink")).toBe(true);
    expect(isThemeId("custom:theme-1")).toBe(true);
    expect(isThemeId("custom:")).toBe(false);
    expect(isThemeId("pink")).toBe(true);
    expect(isPresetThemeId("custom:theme-1")).toBe(false);
    expect(isThemeId("purple")).toBe(false);
  });
});
