import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../markdown/parseMarkdown";
import { defaultAutomaticTiming } from "../project/projectModel";
import { calculateAutomaticWordDuration, createAutomaticReadingWords } from "./automaticTiming";
import { numberToWords, pronounceNumericToken } from "./numberToWords";

describe("numberToWords", () => {
  it("converts integers in Spanish and English", () => {
    expect(numberToWords(200, "es")).toBe("doscientos");
    expect(numberToWords(200, "en")).toBe("two hundred");
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
  it("keeps a number as one visible word and bases its timing on spoken words", () => {
    const source = "El total es 2.500.";
    const document = parseMarkdown(source);
    const words = createAutomaticReadingWords(document, { ...defaultAutomaticTiming, language: "es" });
    expect(words.map(({ displayText }) => displayText)).toEqual(["El", "total", "es", "2.500."]);
    expect(words[3].spokenText).toBe("dos mil quinientos.");
    expect(words[3].durationMilliseconds).toBeGreaterThan(words[3].displayText.length * defaultAutomaticTiming.baseMillisecondsPerCharacter);
    expect(document.sourceMarkdown).toBe(source);
    expect(words[words.length - 1].punctuation).toBe("sentence");
  });

  it("converts 200 for the selected language without adding navigation steps", () => {
    const document = parseMarkdown("200");
    const spanish = createAutomaticReadingWords(document, { ...defaultAutomaticTiming, language: "es" });
    const english = createAutomaticReadingWords(document, { ...defaultAutomaticTiming, language: "en" });
    expect(spanish).toHaveLength(1);
    expect(spanish[0]).toMatchObject({ displayText: "200", spokenText: "doscientos" });
    expect(english[0]).toMatchObject({ displayText: "200", spokenText: "two hundred" });
    expect(english[0].durationMilliseconds).toBeGreaterThan(spanish[0].durationMilliseconds);
  });

  it("adds natural pauses for commas, semicolons, sentences, and line endings", () => {
    const document = parseMarkdown("Hola, mundo; bien.\nSigue");
    const words = createAutomaticReadingWords(document, { ...defaultAutomaticTiming, paragraphPauseMilliseconds: 100 });
    expect(words[0].durationMilliseconds).toBe(4 * 78 + 180);
    expect(words[1].durationMilliseconds).toBe(5 * 78 + 273);
    expect(words[2].durationMilliseconds).toBe(4 * 78 + 420 + 100);
    expect(words[3].durationMilliseconds).toBe(5 * 78 + 100);
  });

  it("scales word duration with the selected reading rate", () => {
    const document = parseMarkdown("ScriptArc");
    const slower = createAutomaticReadingWords(document, defaultAutomaticTiming, 80);
    const faster = createAutomaticReadingWords(document, defaultAutomaticTiming, 240);
    expect(slower[0].durationMilliseconds).toBeGreaterThan(faster[0].durationMilliseconds);
  });

  it("uses punctuation pauses and clamps extreme word durations", () => {
    const comma = calculateAutomaticWordDuration("Hola,", "comma", false, defaultAutomaticTiming);
    const semicolon = calculateAutomaticWordDuration("Hola;", "semicolon", false, defaultAutomaticTiming);
    const colon = calculateAutomaticWordDuration("Hola:", "colon", false, defaultAutomaticTiming);
    const sentence = calculateAutomaticWordDuration("Hola.", "sentence", false, defaultAutomaticTiming);
    expect(comma).toBe(4 * 78 + 180);
    expect(semicolon).toBe(4 * 78 + 273);
    expect(colon).toBe(semicolon);
    expect(sentence).toBe(4 * 78 + 420);
    expect(calculateAutomaticWordDuration("a", null, false, defaultAutomaticTiming, 240)).toBe(250);
    expect(calculateAutomaticWordDuration("a".repeat(2000), null, false, defaultAutomaticTiming, 80)).toBe(8000);
  });
});
