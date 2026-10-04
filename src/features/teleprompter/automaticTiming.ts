import type { AutomaticTimingSettings, MarkdownToken, ParsedMarkdownDocument, ReadingWord } from "../../shared/types";
import { pronounceNumericToken } from "./numberToWords";

export function createAutomaticReadingWords(
  document: ParsedMarkdownDocument,
  settings: AutomaticTimingSettings,
  wordsPerMinute = 160,
): ReadingWord[] {
  const speedScale = 160 / Math.max(80, Math.min(240, wordsPerMinute));
  const finalTokens = new Set(document.blocks.map((block) => block.tokenEnd - 1));

  return document.tokens.map((token) => {
    const spokenText = pronounceNumericToken(token.displayText, settings.language) ?? token.spokenText;
    const spokenLength = stripTrailingPunctuation(spokenText).length;
    const pause = pauseAfter(token.punctuation, finalTokens.has(token.index), settings);
    return {
      ...token,
      displayText: token.displayText,
      visibleText: token.displayText,
      spokenText,
      sourceTokenIndex: token.index,
      durationMilliseconds: Math.max(180, Math.round(spokenLength * settings.baseMillisecondsPerCharacter * speedScale)) + pause,
    };
  });
}

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[.,;:!?…)}\]”’"'»}]+$/u, "");
}

function pauseAfter(
  punctuation: MarkdownToken["punctuation"],
  isBlockEnd: boolean,
  settings: AutomaticTimingSettings,
): number {
  let pause = 0;
  if (punctuation === "comma") pause += settings.commaPauseMilliseconds;
  else if (punctuation === "semicolon" || punctuation === "colon") pause += Math.round(settings.sentencePauseMilliseconds * 0.65);
  else if (punctuation === "sentence") pause += settings.sentencePauseMilliseconds;
  if (isBlockEnd) pause += settings.paragraphPauseMilliseconds;
  return pause;
}
