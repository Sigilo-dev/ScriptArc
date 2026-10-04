import type {
  Language,
  ManualWordTiming,
  ScriptProject,
  ThemeId,
  TimingMode,
} from "../../shared/types";

export const CURRENT_PROJECT_FORMAT = 1 as const;

export const defaultProjectPreferences = {
  theme: "white",
  fontSize: 56,
  lineHeight: 1.35,
  wordsPerMinute: 160,
} as const;

export const defaultAutomaticTiming = {
  language: "es",
  baseMillisecondsPerCharacter: 78,
  commaPauseMilliseconds: 180,
  sentencePauseMilliseconds: 420,
  paragraphPauseMilliseconds: 650,
} as const;

export function createProject(sourceMarkdown = "", now = new Date()): ScriptProject {
  const timestamp = now.toISOString();
  return {
    formatVersion: CURRENT_PROJECT_FORMAT,
    id: createProjectId(),
    title: inferProjectTitle(sourceMarkdown),
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceMarkdown,
    timingMode: "automatic",
    automaticTiming: { ...defaultAutomaticTiming },
    manualTimings: [],
    preferences: { ...defaultProjectPreferences },
  };
}

export function updateProjectMarkdown(project: ScriptProject, sourceMarkdown: string, now = new Date()): ScriptProject {
  const sourceChanged = sourceMarkdown !== project.sourceMarkdown;
  return {
    ...project,
    title: inferProjectTitle(sourceMarkdown),
    sourceMarkdown,
    ...(sourceChanged ? { manualTimings: [] } : {}),
    updatedAt: now.toISOString(),
  };
}

export function serializeProject(project: ScriptProject): string {
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(serialized: string): ScriptProject {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error("El archivo no contiene un proyecto ScriptArc válido.");
  }
  return migrateProject(value);
}

export function migrateProject(value: unknown): ScriptProject {
  if (!isRecord(value)) throw new Error("El proyecto debe ser un objeto JSON.");
  if (value.formatVersion === CURRENT_PROJECT_FORMAT) return validateCurrentProject(value);
  if (value.formatVersion === 0) return migrateVersionZero(value);
  throw new Error(`Versión de proyecto no compatible: ${String(value.formatVersion)}.`);
}

function migrateVersionZero(value: Record<string, unknown>): ScriptProject {
  if (typeof value.markdown !== "string") throw new Error("El proyecto antiguo no incluye Markdown válido.");
  const created = createProject(value.markdown);
  const language: Language = value.language === "en" ? "en" : "es";
  const timingMode: TimingMode = value.mode === "manual" ? "manual" : "automatic";
  return { ...created, id: typeof value.id === "string" ? value.id : created.id, timingMode, automaticTiming: { ...created.automaticTiming, language } };
}

function validateCurrentProject(value: Record<string, unknown>): ScriptProject {
  if (typeof value.id !== "string" || typeof value.title !== "string" || typeof value.sourceMarkdown !== "string") {
    throw new Error("El proyecto no contiene sus campos principales.");
  }
  if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") {
    throw new Error("El proyecto tiene fechas no válidas.");
  }
  if (!isTimingMode(value.timingMode) || !isRecord(value.automaticTiming) || !isRecord(value.preferences)) {
    throw new Error("La configuración del proyecto no es válida.");
  }
  if (!Array.isArray(value.manualTimings) || !value.manualTimings.every(isManualTiming)) {
    throw new Error("Los tiempos manuales del proyecto no son válidos.");
  }

  const automaticTiming = value.automaticTiming;
  const preferences = value.preferences;
  if (!isLanguage(automaticTiming.language) || !isThemeId(preferences.theme)) {
    throw new Error("El idioma o el tema del proyecto no son válidos.");
  }
  const baseMillisecondsPerCharacter = readFiniteNumber(automaticTiming.baseMillisecondsPerCharacter);
  const commaPauseMilliseconds = readFiniteNumber(automaticTiming.commaPauseMilliseconds);
  const sentencePauseMilliseconds = readFiniteNumber(automaticTiming.sentencePauseMilliseconds);
  const paragraphPauseMilliseconds = readFiniteNumber(automaticTiming.paragraphPauseMilliseconds);
  const fontSize = readFiniteNumber(preferences.fontSize);
  const lineHeight = readFiniteNumber(preferences.lineHeight);
  const wordsPerMinute = readFiniteNumber(preferences.wordsPerMinute);
  if (baseMillisecondsPerCharacter <= 0 || fontSize <= 0 || lineHeight < 1 || wordsPerMinute <= 0) {
    throw new Error("Los valores de ritmo y presentación deben ser positivos.");
  }

  return {
    formatVersion: CURRENT_PROJECT_FORMAT,
    id: value.id,
    title: value.title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    sourceMarkdown: value.sourceMarkdown,
    timingMode: value.timingMode,
    automaticTiming: {
      language: automaticTiming.language,
      baseMillisecondsPerCharacter,
      commaPauseMilliseconds,
      sentencePauseMilliseconds,
      paragraphPauseMilliseconds,
    },
    manualTimings: value.manualTimings.filter(isManualTiming),
    preferences: {
      theme: preferences.theme,
      fontSize,
      lineHeight,
      wordsPerMinute,
    },
  };
}

function inferProjectTitle(sourceMarkdown: string): string {
  const heading = sourceMarkdown.split(/\r?\n/u).find((line) => /^#{1,6}\s+\S/u.test(line));
  return heading ? heading.replace(/^#{1,6}\s+/u, "").trim() : "Guion sin título";
}

function createProjectId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `script-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readFiniteNumber(value: unknown): number {
  if (!isFiniteNumber(value)) throw new Error("Los valores de configuración deben ser números finitos.");
  return value;
}

function isLanguage(value: unknown): value is Language {
  return value === "es" || value === "en";
}

function isTimingMode(value: unknown): value is TimingMode {
  return value === "automatic" || value === "manual";
}

function isThemeId(value: unknown): value is ThemeId {
  return value === "white" || value === "gray" || value === "orange" || value === "blue" || value === "pink" || value === "black";
}

function isManualTiming(value: unknown): value is ManualWordTiming {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.tokenIndex) && isFiniteNumber(value.durationMilliseconds) && value.durationMilliseconds > 0;
}
