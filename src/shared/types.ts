export type Language = "es" | "en";
export type TimingMode = "automatic" | "manual";
export type ThemeId = "white" | "gray" | "orange" | "blue" | "pink" | "black";

export interface AutomaticTimingSettings {
  language: Language;
  baseMillisecondsPerCharacter: number;
  commaPauseMilliseconds: number;
  sentencePauseMilliseconds: number;
  paragraphPauseMilliseconds: number;
}

export interface ManualWordTiming {
  tokenIndex: number;
  durationMilliseconds: number;
}

export interface TeleprompterPreferences {
  theme: ThemeId;
  fontSize: number;
  lineHeight: number;
  wordsPerMinute: number;
}

export interface ScriptProject {
  formatVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceMarkdown: string;
  timingMode: TimingMode;
  automaticTiming: AutomaticTimingSettings;
  manualTimings: ManualWordTiming[];
  preferences: TeleprompterPreferences;
}

export interface MarkdownToken {
  index: number;
  displayText: string;
  visibleText: string;
  spokenText: string;
  sourceStart: number;
  sourceEnd: number;
  emphasis: "strong" | "emphasis" | "strikethrough" | null;
  emphasisStyles: Array<"strong" | "emphasis" | "strikethrough">;
  punctuation: "comma" | "semicolon" | "colon" | "sentence" | null;
}

export interface MarkdownBlock {
  kind: "heading" | "paragraph" | "list-item" | "quote";
  level?: number;
  visibleText: string;
  tokenStart: number;
  tokenEnd: number;
}

export interface ParsedMarkdownDocument {
  sourceMarkdown: string;
  visibleText: string;
  spokenText: string;
  blocks: MarkdownBlock[];
  tokens: MarkdownToken[];
}

export interface ReadingWord extends MarkdownToken {
  sourceTokenIndex: number;
  durationMilliseconds: number;
}
