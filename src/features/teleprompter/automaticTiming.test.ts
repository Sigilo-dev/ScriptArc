import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../markdown/parseMarkdown";
import { defaultAutomaticTiming } from "../project/projectModel";
import { createAutomaticReadingWords } from "./automaticTiming";
import { numberToWords, pronounceNumericToken } from "./numberToWords";

describe("numberToWords", () => {
  it("converts integers in Spanish and English", () => {
    expect(numberToWords(200, "es")).toBe("doscientos");
    expect(numberToWords(24_807, "es")).toBe("veinticuatro mil ochocientos siete");
    expect(numberToWords(2_500, "en")).toBe("two thousand five hundred");
    expect(numberToWords(21, "en")).toBe("twenty-one");
  });

  it("keeps punctuation with the final word of a numeric phrase", () => {
    expect(pronounceNumericToken("24.807,", "es")).toBe("veinticuatro mil ochocientos siete,");
    expect(pronounceNumericToken("2,500.", "en")).toBe("two thousand five hundred.");
    expect(pronounceNumericToken("1,5", "es")).toBeNull();
  });
});

describe("automatic reading words", () => {
  it("expands a number for speech without changing canonical Markdown", () => {
    const source = "El total es 2.500.";
    const document = parseMarkdown(source);
    const words = createAutomaticReadingWords(document, { ...defaultAutomaticTiming, language: "es" });
    expect(words.map(({ visibleText }) => visibleText)).toEqual(["El", "total", "es", "dos", "mil", "quinientos."]);
    expect(document.sourceMarkdown).toBe(source);
    expect(words[words.length - 1].punctuation).toBe("sentence");
  });

  it("adds natural pauses for commas, semicolons, sentences, and line endings", () => {
    const document = parseMarkdown("Hola, mundo; bien.\nSigue");
    const words = createAutomaticReadingWords(document, { ...defaultAutomaticTiming, paragraphPauseMilliseconds: 100 });
    expect(words[0].durationMilliseconds).toBe(5 * 78 + 180);
    expect(words[1].durationMilliseconds).toBe(6 * 78 + 273);
    expect(words[2].durationMilliseconds).toBe(5 * 78 + 420 + 100);
    expect(words[3].durationMilliseconds).toBe(5 * 78 + 100);
  });
});
