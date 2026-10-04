import type {
  Language,
  ManualWordTiming,
  ScriptProject,
  TimingMode,
  UserPreferences,
} from "../../shared/types";
import { parseMarkdown } from "../markdown/parseMarkdown";
import { THEME_PALETTES } from "../settings/themes";

export const CURRENT_PROJECT_FORMAT = 2 as const;

export const defaultUserPreferences: UserPreferences = {
  interfaceLanguage: "es",
  theme: "white",
  customPalette: { ...THEME_PALETTES.white },
  customPaletteInitialized: false,
  defaultFontSize: 56,
  defaultWordsPerMinute: 160,
  defaultLanguage: "es",
  countdownSeconds: 5,
  hideControlsAutomatically: true,
} as const;

export const defaultAutomaticTiming = {
  language: "es",
  wordsPerMinute: 160,
  baseMillisecondsPerCharacter: 78,
  commaPauseMilliseconds: 180,
  sentencePauseMilliseconds: 420,
  paragraphPauseMilliseconds: 650,
} as const;

export function createProject(
  sourceMarkdown = "",
  now = new Date(),
  defaults: Pick<UserPreferences, "defaultFontSize" | "defaultWordsPerMinute" | "defaultLanguage"> = defaultUserPreferences,
): ScriptProject {
  const timestamp = now.toISOString();
  return {
    formatVersion: CURRENT_PROJECT_FORMAT,
    id: createProjectId(),
    title: inferProjectTitle(sourceMarkdown),
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceMarkdown,
    timingMode: "automatic",
    lastPosition: 0,
    automaticTiming: {
      ...defaultAutomaticTiming,
      language: defaults.defaultLanguage,
      wordsPerMinute: defaults.defaultWordsPerMinute,
    },
    manualTimings: [],
    teleprompterSettings: { fontSize: defaults.defaultFontSize, lineHeight: 1.35 },
  };
}

export function updateProjectMarkdown(project: ScriptProject, sourceMarkdown: string, now = new Date()): ScriptProject {
  const sourceChanged = sourceMarkdown !== project.sourceMarkdown;
  return {
    ...project,
    title: inferProjectTitle(sourceMarkdown),
    sourceMarkdown,
    ...(sourceChanged ? { manualTimings: [], lastPosition: 0 } : {}),
    updatedAt: now.toISOString(),
  };
}

export function serializeProject(project: ScriptProject): string {
  return JSON.stringify(validateCurrentProject(project), null, 2);
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
  if (value.formatVersion === 1) return migrateVersionOne(value);
  if (value.formatVersion === 0) return migrateVersionZero(value);
  if (typeof value.formatVersion === "number" && value.formatVersion > CURRENT_PROJECT_FORMAT) {
    throw new Error(`Este proyecto fue creado con una versión futura incompatible (${value.formatVersion}). Actualiza ScriptArc para abrirlo.`);
  }
  throw new Error(`La versión del proyecto no está soportada: ${String(value.formatVersion)}.`);
}

function migrateVersionZero(value: Record<string, unknown>): ScriptProject {
  if (typeof value.markdown !== "string") throw new Error("El proyecto antiguo no incluye Markdown válido.");
  const created = createProject(value.markdown);
  const language: Language = value.language === "en" ? "en" : "es";
  const timingMode: TimingMode = value.mode === "manual" ? "manual" : "automatic";
  return { ...created, id: typeof value.id === "string" ? value.id : created.id, timingMode, automaticTiming: { ...created.automaticTiming, language } };
}

function migrateVersionOne(value: Record<string, unknown>): ScriptProject {
  if (typeof value.id !== "string" || typeof value.sourceMarkdown !== "string") {
    throw new Error("El proyecto de versión 1 no contiene sus campos principales.");
  }
  const priorTiming = isRecord(value.automaticTiming) ? value.automaticTiming : {};
  const priorPreferences = isRecord(value.preferences) ? value.preferences : {};
  const defaults = {
    defaultFontSize: finiteOr(priorPreferences.fontSize, defaultUserPreferences.defaultFontSize),
    defaultWordsPerMinute: finiteOr(priorPreferences.wordsPerMinute, defaultUserPreferences.defaultWordsPerMinute),
    defaultLanguage: priorTiming.language === "en" ? "en" as const : "es" as const,
  };
  const migrated = createProject(value.sourceMarkdown, new Date(), defaults);
  return validateCurrentProject({
    ...migrated,
    id: value.id,
    title: typeof value.title === "string" ? value.title : migrated.title,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : migrated.createdAt,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : migrated.updatedAt,
    timingMode: value.timingMode,
    lastPosition: 0,
    automaticTiming: { ...migrated.automaticTiming, ...priorTiming, language: defaults.defaultLanguage, wordsPerMinute: defaults.defaultWordsPerMinute },
    manualTimings: value.manualTimings,
    teleprompterSettings: { fontSize: defaults.defaultFontSize, lineHeight: finiteOr(priorPreferences.lineHeight, 1.35) },
  });
}

function validateCurrentProject(input: unknown): ScriptProject {
  if (!isRecord(input)) throw new Error("El proyecto debe ser un objeto JSON.");
  const value = input;
  if (typeof value.id !== "string" || typeof value.title !== "string" || typeof value.sourceMarkdown !== "string") {
    throw new Error("El proyecto no contiene sus campos principales.");
  }
  if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") {
    throw new Error("El proyecto tiene fechas no válidas.");
  }
  if (Number.isNaN(Date.parse(value.createdAt)) || Number.isNaN(Date.parse(value.updatedAt))) {
    throw new Error("El proyecto contiene fechas mal formadas.");
  }
  if (!isTimingMode(value.timingMode) || !isRecord(value.automaticTiming) || !isRecord(value.teleprompterSettings)) {
    throw new Error("La configuración del proyecto no es válida.");
  }
  if (!Array.isArray(value.manualTimings) || !value.manualTimings.every(isManualTiming)) {
    throw new Error("Los tiempos manuales del proyecto no son válidos.");
  }
  const manualIndices = value.manualTimings.map((timing) => timing.tokenIndex);
  if (new Set(manualIndices).size !== manualIndices.length || manualIndices.some((index) => index < 0 || index > 500_000)) {
    throw new Error("Los tiempos manuales tienen índices duplicados o fuera de rango.");
  }
  const tokenCount = parseMarkdown(value.sourceMarkdown).tokens.length;
  if (!Number.isInteger(value.lastPosition) || (value.lastPosition as number) < 0 || (value.lastPosition as number) > tokenCount) {
    throw new Error("La posición guardada no coincide con las palabras del guion.");
  }
  if (manualIndices.some((index) => index >= tokenCount)) {
    throw new Error("Los tiempos manuales no coinciden con las palabras del guion.");
  }

  const automaticTiming = value.automaticTiming;
  const teleprompterSettings = value.teleprompterSettings;
  if (!isLanguage(automaticTiming.language)) {
    throw new Error("El idioma automático del proyecto no es válido.");
  }
  const wordsPerMinute = readFiniteNumber(automaticTiming.wordsPerMinute);
  const baseMillisecondsPerCharacter = readFiniteNumber(automaticTiming.baseMillisecondsPerCharacter);
  const commaPauseMilliseconds = readFiniteNumber(automaticTiming.commaPauseMilliseconds);
  const sentencePauseMilliseconds = readFiniteNumber(automaticTiming.sentencePauseMilliseconds);
  const paragraphPauseMilliseconds = readFiniteNumber(automaticTiming.paragraphPauseMilliseconds);
  const fontSize = readFiniteNumber(teleprompterSettings.fontSize);
  const lineHeight = readFiniteNumber(teleprompterSettings.lineHeight);
  if (baseMillisecondsPerCharacter <= 0 || commaPauseMilliseconds < 0 || sentencePauseMilliseconds < 0 || paragraphPauseMilliseconds < 0 || fontSize < 30 || fontSize > 120 || lineHeight < 1 || wordsPerMinute < 40 || wordsPerMinute > 400) {
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
    lastPosition: value.lastPosition as number,
    automaticTiming: {
      language: automaticTiming.language,
      wordsPerMinute,
      baseMillisecondsPerCharacter,
      commaPauseMilliseconds,
      sentencePauseMilliseconds,
      paragraphPauseMilliseconds,
    },
    manualTimings: [...value.manualTimings].sort((a, b) => a.tokenIndex - b.tokenIndex),
    teleprompterSettings: {
      fontSize,
      lineHeight,
    },
  };
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

function isManualTiming(value: unknown): value is ManualWordTiming {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.tokenIndex) && Number.isInteger(value.durationMilliseconds)
    && isFiniteNumber(value.durationMilliseconds) && value.durationMilliseconds >= 250 && value.durationMilliseconds <= 6000;
}
