import type { AutomaticTimingSettings, MarkdownToken, ParsedMarkdownDocument, ReadingWord } from "../../shared/types";
import { pronounceNumericToken } from "./numberToWords";

export const AUTOMATIC_TIMING_LIMITS = {
  referenceWordsPerMinute: 160,
  minimumWordsPerMinute: 80,
  maximumWordsPerMinute: 240,
  minimumWordMilliseconds: 250,
  maximumWordMilliseconds: 8000,
  semicolonPauseRatio: 0.65,
} as const;

export function createAutomaticReadingWords(
  document: ParsedMarkdownDocument,
  settings: AutomaticTimingSettings,
  wordsPerMinute: number = AUTOMATIC_TIMING_LIMITS.referenceWordsPerMinute,
): ReadingWord[] {
  const finalTokens = new Set(document.blocks.map((block) => block.tokenEnd - 1));

  return document.tokens.map((token) => {
    const spokenText = pronounceNumericToken(token.displayText, settings.language) ?? token.spokenText;
    return {
      ...token,
      displayText: token.displayText,
      visibleText: token.displayText,
      spokenText,
      sourceTokenIndex: token.index,
      durationMilliseconds: calculateAutomaticWordDuration(spokenText, token.punctuation, finalTokens.has(token.index), settings, wordsPerMinute),
    };
  });
}

export function calculateAutomaticWordDuration(
  spokenText: string,
  punctuation: MarkdownToken["punctuation"],
  isBlockEnd: boolean,
  settings: AutomaticTimingSettings,
  wordsPerMinute: number = AUTOMATIC_TIMING_LIMITS.referenceWordsPerMinute,
): number {
  const boundedWpm = Math.max(
    AUTOMATIC_TIMING_LIMITS.minimumWordsPerMinute,
    Math.min(AUTOMATIC_TIMING_LIMITS.maximumWordsPerMinute, wordsPerMinute),
  );
  const spokenLength = stripTrailingPunctuation(spokenText).trim().length || 1;
  const wordMilliseconds = Math.round(
    spokenLength * settings.baseMillisecondsPerCharacter * AUTOMATIC_TIMING_LIMITS.referenceWordsPerMinute / boundedWpm,
  );
  const pause = pauseAfter(punctuation, isBlockEnd, settings);
  return Math.max(
    AUTOMATIC_TIMING_LIMITS.minimumWordMilliseconds,
    Math.min(AUTOMATIC_TIMING_LIMITS.maximumWordMilliseconds, wordMilliseconds + pause),
  );
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
  else if (punctuation === "semicolon" || punctuation === "colon") {
    pause += Math.round(settings.sentencePauseMilliseconds * AUTOMATIC_TIMING_LIMITS.semicolonPauseRatio);
  }
  else if (punctuation === "sentence") pause += settings.sentencePauseMilliseconds;
  if (isBlockEnd) pause += settings.paragraphPauseMilliseconds;
  return pause;
}
