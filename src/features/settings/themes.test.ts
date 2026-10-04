import { describe, expect, it } from "vitest";
import { defaultProjectPreferences } from "../project/projectModel";
import { isThemeId, THEME_OPTIONS } from "./themes";

describe("themes", () => {
  it("provides all six preset themes and starts with white", () => {
    expect(THEME_OPTIONS.map((theme) => theme.id)).toEqual(["white", "gray", "orange", "blue", "pink", "black"]);
    expect(defaultProjectPreferences.theme).toBe("white");
    expect(isThemeId("pink")).toBe(true);
    expect(isThemeId("purple")).toBe(false);
  });
});
