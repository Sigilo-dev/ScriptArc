import { describe, expect, it } from "vitest";
import { translate, translateErrorMessage } from "./localization";

describe("interface localization", () => {
  it("provides Spanish and English UI text with interpolated values", () => {
    expect(translate("es", "skip")).toBe("Saltar");
    expect(translate("en", "skip")).toBe("Skip");
    expect(translate("en", "unsavedDescription", { name: "script.scriptarc" }))
      .toContain("script.scriptarc");
  });

  it("translates project validation errors for the selected interface language", () => {
    const message = "El proyecto debe ser un objeto JSON.";
    expect(translateErrorMessage(message, "es")).toBe(message);
    expect(translateErrorMessage(message, "en")).toBe("The project must be a JSON object.");
  });
});
