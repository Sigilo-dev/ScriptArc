import type { AutomaticTimingSettings, MarkdownToken, ParsedMarkdownDocument, ReadingWord } from "../../shared/types";
import { pronounceNumericToken } from "./numberToWords";

export function createAutomaticReadingWords(
  document: ParsedMarkdownDocument,
  settings: AutomaticTimingSettings,
  wordsPerMinute = 160,
): ReadingWord[] {
  const speedScale = 160 / Math.max(80, Math.min(240, wordsPerMinute));
  const finalTokens = new Set(document.blocks.map((block) => block.tokenEnd - 1));
  const words: ReadingWord[] = [];
  for (const token of document.tokens) {
    const spokenNumber = pronounceNumericToken(token.visibleText, settings.language);
    const pieces = spokenNumber?.split(/\s+/u) ?? [token.visibleText];
    pieces.forEach((piece, partIndex) => {
      const isFinalPiece = partIndex === pieces.length - 1;
      const punctuation = isFinalPiece ? token.punctuation : null;
      const pause = pauseAfter(punctuation, finalTokens.has(token.index) && isFinalPiece, settings);
      const visibleText = piece;
      words.push({
        ...token,
        index: words.length,
        sourceTokenIndex: token.index,
        visibleText,
        spokenText: visibleText,
        punctuation,
        durationMilliseconds: Math.max(180, Math.round(visibleText.length * settings.baseMillisecondsPerCharacter * speedScale)) + pause,
        isNumberExpansion: spokenNumber !== null,
      });
    });
  }
  return words;
}

function pauseAfter(
  punctuation: MarkdownToken["punctuation"],
  isBlockEnd: boolean,
  settings: AutomaticTimingSettings,
): number {
  let pause = 0;
  if (punctuation === "comma") pause += settings.commaPauseMilliseconds;
  else if (punctuation === "semicolon") pause += Math.round(settings.sentencePauseMilliseconds * 0.65);
  else if (punctuation === "sentence") pause += settings.sentencePauseMilliseconds;
  if (isBlockEnd) pause += settings.paragraphPauseMilliseconds;
  return pause;
}
