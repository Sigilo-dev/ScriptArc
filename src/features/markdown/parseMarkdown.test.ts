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

  it("treats sentence punctuation as part of the spoken word", () => {
    expect(parseMarkdown("Hola.").tokens.map(({ displayText }) => displayText)).toEqual(["Hola."]);
    expect(parseMarkdown("Hola, mundo.").tokens.map(({ displayText }) => displayText)).toEqual(["Hola,", "mundo."]);
    expect(parseMarkdown("¿Cómo estás?").tokens.map(({ displayText }) => displayText)).toEqual(["¿Cómo", "estás?"]);
    expect(parseMarkdown("Hola , mundo .").tokens.map(({ displayText }) => displayText)).toEqual(["Hola,", "mundo."]);
  });

  it("preserves rich Markdown styles, nesting, and heading levels on word tokens", () => {
    const document = parseMarkdown("### Título\nEsto es **muy importante**. También *cambia* y ~~mantén~~.");
    expect(document.blocks[0]).toMatchObject({ kind: "heading", level: 3 });
    expect(document.tokens.map(({ displayText }) => displayText)).toEqual([
      "Título", "Esto", "es", "muy", "importante.", "También", "cambia", "y", "mantén.",
    ]);
    expect(document.tokens[3].emphasisStyles).toContain("strong");
    expect(document.tokens[6].emphasisStyles).toEqual(["emphasis"]);
    expect(document.tokens[8].emphasisStyles).toEqual(["strikethrough"]);
    expect(document.spokenText).not.toMatch(/[#*_~]/u);
  });

  it("recognizes lists and links while omitting formatting labels", () => {
    const document = parseMarkdown("- Lee [este guion](https://example.com).\n1. Sigue el paso");
    expect(document.blocks.map(({ kind }) => kind)).toEqual(["list-item", "list-item"]);
    expect(document.spokenText).toBe("Lee este guion. Sigue el paso");
  });

  it("parses nested formatting inside links and never exposes raw HTML tags", () => {
    const document = parseMarkdown("[**OpenAI**](https://openai.com) <script>alert(1)</script>");
    expect(document.tokens.map(({ displayText }) => displayText)).toEqual(["OpenAI", "alert(1)"]);
    expect(document.tokens[0].emphasisStyles).toContain("strong");
    expect(document.visibleText).not.toContain("script");
  });

  it("keeps reasonable nested emphasis on individual words", () => {
    const document = parseMarkdown("**important *very important* text**");
    expect(document.tokens.map(({ displayText }) => displayText)).toEqual(["important", "very", "important", "text"]);
    expect(document.tokens[0].emphasisStyles).toEqual(["strong"]);
    expect(document.tokens[1].emphasisStyles).toEqual(["strong", "emphasis"]);
  });
});
