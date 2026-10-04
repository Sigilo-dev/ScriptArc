export type Language = "es" | "en";
export type TimingMode = "automatic" | "manual";
export type ThemeId = "white" | "gray" | "orange" | "blue" | "pink" | "black";

export interface AutomaticTimingSettings {
  language: Language;
  wordsPerMinute: number;
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
  fontSize: number;
  lineHeight: number;
}

export interface UserPreferences {
  interfaceLanguage: Language;
  theme: ThemeId;
  defaultFontSize: number;
  defaultWordsPerMinute: number;
  defaultLanguage: Language;
  countdownSeconds: number;
  hideControlsAutomatically: boolean;
}

export interface ScriptProject {
  formatVersion: 2;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceMarkdown: string;
  timingMode: TimingMode;
  lastPosition: number;
  automaticTiming: AutomaticTimingSettings;
  manualTimings: ManualWordTiming[];
  teleprompterSettings: TeleprompterPreferences;
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
