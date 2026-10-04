import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parseMarkdown";

describe("parseMarkdown", () => {
  it("does not expose Markdown markers as spoken words", () => {
    const document = parseMarkdown("## Introducción\n\nEsto es **muy importante**.\nDebemos hablar *más lentamente* aquí.\n~~Nombre provisional~~");
    expect(document.visibleText).toBe("Introducción\nEsto es muy importante.\nDebemos hablar más lentamente aquí.\nNombre provisional");
    expect(document.spokenText).toBe(document.visibleText.replace(/\n/gu, " "));
    expect(document.spokenText).not.toMatch(/[#*_~]/u);
  });

  it("keeps punctuation attached to the final word and reports emphasis", () => {
    const document = parseMarkdown("Hola, **Mariano;** termina aquí.");
    expect(document.tokens.map(({ visibleText }) => visibleText)).toEqual(["Hola,", "Mariano;", "termina", "aquí."]);
    expect(document.tokens[1].emphasis).toBe("strong");
    expect(document.tokens[1].punctuation).toBe("semicolon");
  });

  it("recognizes lists and links while omitting formatting labels", () => {
    const document = parseMarkdown("- Lee [este guion](https://example.com).\n1. Sigue el paso");
    expect(document.blocks.map(({ kind }) => kind)).toEqual(["list-item", "list-item"]);
    expect(document.spokenText).toBe("Lee este guion. Sigue el paso");
  });
});
