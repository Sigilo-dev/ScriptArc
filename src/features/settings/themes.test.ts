import { describe, expect, it } from "vitest";
import { defaultUserPreferences } from "../project/projectModel";
import { isThemeId, THEME_OPTIONS } from "./themes";

describe("themes", () => {
  it("provides six preset themes, a custom option, and starts with white", () => {
    expect(THEME_OPTIONS.filter((theme) => theme.id !== "custom").map((theme) => theme.id))
      .toEqual(["white", "gray", "orange", "blue", "pink", "black"]);
    expect(isThemeId("custom")).toBe(true);
    expect(defaultUserPreferences.theme).toBe("white");
    expect(isThemeId("pink")).toBe(true);
    expect(isThemeId("purple")).toBe(false);
  });
});
