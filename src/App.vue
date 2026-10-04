<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import ScriptEditor from "./features/editor/ScriptEditor.vue";
import { parseMarkdown } from "./features/markdown/parseMarkdown";
import { createProject, updateProjectMarkdown } from "./features/project/projectModel";
import {
  clearRecoveryDraft,
  loadRecoveryDraft,
  openProjectFile,
  projectFingerprint,
  saveProjectFile,
  saveRecoveryDraft,
} from "./features/project/projectPersistence";
import { createAutomaticReadingWords } from "./features/teleprompter/automaticTiming";
import {
  advanceManualRecording,
  createManualRecordingSession,
  finishManualRecording,
  manualWordDuration,
  retreatManualRecording,
  startManualRecording,
} from "./features/teleprompter/manualTiming";
import SettingsPanel from "./features/settings/SettingsPanel.vue";
import { loadUserPreferences, saveUserPreferences } from "./features/settings/userPreferences";
import TeleprompterText from "./features/teleprompter/TeleprompterText.vue";
import { formatPlaybackTime } from "./features/teleprompter/playbackState";
import { usePlayback } from "./features/teleprompter/usePlayback";
import type { Language, ReadingWord, TimingMode, UserPreferences } from "./shared/types";

type Screen = "editor" | "teleprompter";
type UnsavedChoice = "save" | "discard" | "cancel";

const screen = ref<Screen>("editor");
const userPreferences = ref(loadUserPreferences());
const project = ref(createProject("", new Date(), userPreferences.value));
const filePath = ref<string | null>(null);
const savedFingerprint = ref(projectFingerprint(project.value));
const hasUnsavedChanges = ref(false);
const displayFileName = computed(() => filePath.value?.split(/[\\/]/u).pop() ?? "Proyecto nuevo");
const sourceMarkdown = computed({
  get: () => project.value.sourceMarkdown,
  set: (markdown: string) => {
    const hadTimings = project.value.manualTimings.length > 0;
    const sourceChanged = markdown !== project.value.sourceMarkdown;
    project.value = updateProjectMarkdown(project.value, markdown);
    if (sourceChanged) {
      hasUnsavedChanges.value = true;
      playback.seek(0);
    }
    if (sourceChanged && hadTimings) showNotice("El texto cambió; se eliminaron los tiempos manuales para no asignarlos a otras palabras.");
  },
});
const timingMode = computed(() => project.value.timingMode);
const manualSession = ref(createManualRecordingSession(0));
const isRecording = computed(() => manualSession.value.status === "recording");
const parsedMarkdown = computed(() => parseMarkdown(sourceMarkdown.value));
const automaticWords = computed(() => createAutomaticReadingWords(parsedMarkdown.value, project.value.automaticTiming));
const words = computed<ReadingWord[]>(() => timingMode.value === "automatic"
  ? automaticWords.value
  : parsedMarkdown.value.tokens.map((token) => ({ ...token, sourceTokenIndex: token.index, durationMilliseconds: 0 })));
const playback = usePlayback(words, playbackDuration);
const { cursor, isPlaying, elapsedMilliseconds, remainingMilliseconds, progressPercent } = playback;
const notice = ref("");
const settingsOpen = ref(false);
const automaticLanguagePicker = ref(false);
const appRoot = ref<HTMLElement | null>(null);
const controlsVisible = ref(true);
const isFullscreen = ref(false);
const countdown = ref<number | null>(null);
const appReady = ref(false);
const unsavedDialogOpen = ref(false);
let unsavedChoiceResolver: ((choice: UnsavedChoice) => void) | null = null;
let allowWindowClose = false;
let closeListener: (() => void) | undefined;
let noticeTimeout: number | undefined;
let controlsHideTimeout: number | undefined;
let countdownTimer: number | undefined;
let recoveryTimer: number | undefined;
let focusBeforeDialog: HTMLElement | null = null;
let lastRecoveryWriteAt = 0;
const cancelDialogButton = ref<HTMLButtonElement | null>(null);

watch(project, (value) => {
  if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
  if (!hasUnsavedChanges.value) {
    try { clearRecoveryDraft(); } catch { /* Storage may be unavailable in browser preview. */ }
    return;
  }
  const delay = isPlaying.value ? Math.max(0, 1000 - (Date.now() - lastRecoveryWriteAt)) : 700;
  recoveryTimer = window.setTimeout(() => persistRecoveryDraft(value), delay);
}, { deep: true });

watch(cursor, (position) => {
  if (project.value.lastPosition === position) return;
  project.value.lastPosition = position;
  hasUnsavedChanges.value = true;
});

watch(userPreferences, (value) => {
  try {
    saveUserPreferences(value);
  } catch {
    showNotice("No se pudieron guardar las preferencias en este dispositivo.");
  }
}, { deep: true });

watch(() => userPreferences.value.hideControlsAutomatically, (hideAutomatically) => {
  if (!hideAutomatically) {
    controlsVisible.value = true;
    if (controlsHideTimeout !== undefined) window.clearTimeout(controlsHideTimeout);
  }
});

function showNotice(message: string) {
  notice.value = message;
  if (noticeTimeout !== undefined) window.clearTimeout(noticeTimeout);
  noticeTimeout = window.setTimeout(() => { notice.value = ""; }, 4000);
}

function persistRecoveryDraft(value = project.value) {
  recoveryTimer = undefined;
  try {
    if (hasUnsavedChanges.value) {
      saveRecoveryDraft(value, filePath.value, savedFingerprint.value);
      lastRecoveryWriteAt = Date.now();
    }
    else clearRecoveryDraft();
  } catch {
    showNotice("No se pudo guardar la recuperación local; guarda el proyecto para proteger tus cambios.");
  }
}

function projectDefaults(preferences: UserPreferences = userPreferences.value) {
  return {
    defaultFontSize: preferences.defaultFontSize,
    defaultWordsPerMinute: preferences.defaultWordsPerMinute,
    defaultLanguage: preferences.defaultLanguage,
  };
}

function resetToNewProject() {
  cancelCountdown();
  clearRecoveryDraft();
  stopRecording();
  stopPlayback();
  project.value = createProject("", new Date(), projectDefaults());
  savedFingerprint.value = projectFingerprint(project.value);
  hasUnsavedChanges.value = false;
  filePath.value = null;
  manualSession.value = createManualRecordingSession(0);
  playback.seek(project.value.lastPosition);
  settingsOpen.value = false;
  automaticLanguagePicker.value = false;
  screen.value = "editor";
}

function start(mode: TimingMode) {
  cancelCountdown();
  settingsOpen.value = false;
  automaticLanguagePicker.value = false;
  stopRecording();
  stopPlayback();
  if (project.value.timingMode !== mode) hasUnsavedChanges.value = true;
  project.value = { ...project.value, timingMode: mode };
  manualSession.value = createManualRecordingSession(mode === "manual" ? parsedMarkdown.value.tokens.length : 0, project.value.manualTimings);
  playback.seek(project.value.lastPosition);
  screen.value = "teleprompter";
  showControlsForStartup();
}

function requestUnsavedChoice(): Promise<UnsavedChoice> {
  focusBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  unsavedDialogOpen.value = true;
  void nextTick(() => cancelDialogButton.value?.focus());
  return new Promise((resolve) => { unsavedChoiceResolver = resolve; });
}

function resolveUnsavedChoice(choice: UnsavedChoice) {
  unsavedDialogOpen.value = false;
  const resolve = unsavedChoiceResolver;
  unsavedChoiceResolver = null;
  resolve?.(choice);
  void nextTick(() => focusBeforeDialog?.focus());
}

function handleUnsavedDialogKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    resolveUnsavedChoice("cancel");
  } else if (event.key === "Tab") {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".unsaved-dialog button")];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}

async function confirmLeavingDirtyProject(): Promise<boolean> {
  if (!hasUnsavedChanges.value) return true;
  const choice = await requestUnsavedChoice();
  if (choice === "cancel") return false;
  if (choice === "discard") {
    clearRecoveryDraft();
    return true;
  }
  return saveProject();
}

async function createNewProject() {
  if (await confirmLeavingDirtyProject()) resetToNewProject();
}

function validateManualTimingIndices(openedProject: typeof project.value) {
  const tokenCount = parseMarkdown(openedProject.sourceMarkdown).tokens.length;
  if (openedProject.manualTimings.some(({ tokenIndex }) => tokenIndex >= tokenCount)) {
    throw new Error("El proyecto tiene tiempos manuales que no coinciden con las palabras actuales. El archivo no se abrió.");
  }
}

async function openProject() {
  try {
    const opened = await openProjectFile();
    if (!opened) return;
    validateManualTimingIndices(opened.project);
    if (!(await confirmLeavingDirtyProject())) return;
    cancelCountdown();
    stopRecording();
    stopPlayback();
    project.value = opened.project;
    savedFingerprint.value = projectFingerprint(opened.project);
    hasUnsavedChanges.value = false;
    manualSession.value = createManualRecordingSession(parseMarkdown(opened.project.sourceMarkdown).tokens.length, opened.project.manualTimings);
    settingsOpen.value = false;
    filePath.value = opened.filePath;
    playback.seek(opened.project.lastPosition);
    screen.value = "editor";
    showNotice(`Proyecto abierto: ${opened.project.title}`);
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo abrir el proyecto.");
  }
}

async function saveProject(saveAs = false): Promise<boolean> {
  try {
    const updated = { ...project.value, updatedAt: new Date().toISOString() };
    const savedPath = await saveProjectFile(updated, filePath.value, saveAs);
    if (isTauri() && !savedPath) return false;
    project.value = updated;
    filePath.value = savedPath ?? filePath.value;
    savedFingerprint.value = projectFingerprint(updated);
    hasUnsavedChanges.value = false;
    clearRecoveryDraft();
    showNotice("Proyecto guardado.");
    return true;
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo guardar el proyecto.");
    return false;
  }
}

async function requestWindowClose() {
  persistRecoveryDraft();
  if (!(await confirmLeavingDirtyProject())) return;
  allowWindowClose = true;
  await getCurrentWindow().close();
}

function handlePrompterKey(event: KeyboardEvent) {
  if (screen.value !== "teleprompter") return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true'], button")) return;
  if (countdown.value !== null && event.key !== "Escape") return;

  switch (event.key) {
    case " ":
      event.preventDefault();
      if (isRecording.value) recordCurrentWord();
      else togglePlayback();
      break;
    case "ArrowRight":
      event.preventDefault();
      advance();
      break;
    case "ArrowLeft":
      event.preventDefault();
      retreat();
      break;
    case "Home":
      event.preventDefault();
      if (!isRecording.value) playback.restart();
      break;
    case "End":
      event.preventDefault();
      if (!isRecording.value && !(timingMode.value === "manual" && manualSession.value.status === "ready")) playback.seek(words.value.length);
      break;
    case "Escape":
      if (countdown.value !== null) cancelCountdown();
      else if (document.fullscreenElement) {
        event.preventDefault();
        void document.exitFullscreen();
      } else if (!isFullscreen.value) returnToEditor();
      break;
  }
}

function handlePrompterPointer(event: MouseEvent) {
  if (screen.value !== "teleprompter" || !userPreferences.value.hideControlsAutomatically) return;
  const nearTop = event.clientY <= 86;
  const nearBottom = window.innerHeight - event.clientY <= 112;
  if (!nearTop && !nearBottom) return;
  controlsVisible.value = true;
  if (controlsHideTimeout !== undefined) window.clearTimeout(controlsHideTimeout);
  controlsHideTimeout = window.setTimeout(() => { controlsVisible.value = false; }, 2400);
}

function handleFullscreenChange() {
  isFullscreen.value = document.fullscreenElement !== null;
}

onMounted(async () => {
  window.addEventListener("keydown", handlePrompterKey);
  window.addEventListener("mousemove", handlePrompterPointer);
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  try {
    if (isTauri()) {
      closeListener = await getCurrentWindow().onCloseRequested((event) => {
        if (allowWindowClose) return;
        event.preventDefault();
        if (unsavedDialogOpen.value) return;
        void requestWindowClose();
      });
    } else {
      window.addEventListener("beforeunload", handleBrowserClose);
    }

    const recovery = loadRecoveryDraft();
    if (!recovery) return;
    const shouldRestore = isTauri()
      ? await ask("Se encontró una sesión recuperable con cambios que no se guardaron. ¿Quieres restaurarla?", { title: "Recuperar proyecto", kind: "warning" })
      : window.confirm("Se encontró una sesión recuperable. ¿Quieres restaurarla?");
    if (shouldRestore) {
      validateManualTimingIndices(recovery.project);
      project.value = recovery.project;
      filePath.value = recovery.filePath;
      savedFingerprint.value = recovery.baselineFingerprint;
      hasUnsavedChanges.value = true;
      manualSession.value = createManualRecordingSession(parseMarkdown(recovery.project.sourceMarkdown).tokens.length, recovery.project.manualTimings);
      playback.seek(recovery.project.lastPosition);
      showNotice("Sesión recuperada. Guarda el proyecto para conservar los cambios.");
    } else {
      clearRecoveryDraft();
    }
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo preparar la sesión local.");
  } finally {
    appReady.value = true;
  }
});

onBeforeUnmount(() => {
  persistRecoveryDraft();
  stopPlayback();
  cancelCountdown();
  window.removeEventListener("keydown", handlePrompterKey);
  window.removeEventListener("mousemove", handlePrompterPointer);
  window.removeEventListener("beforeunload", handleBrowserClose);
  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  closeListener?.();
  if (noticeTimeout !== undefined) window.clearTimeout(noticeTimeout);
  if (controlsHideTimeout !== undefined) window.clearTimeout(controlsHideTimeout);
  if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
});

function handleBrowserClose(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value) return;
  persistRecoveryDraft();
  event.preventDefault();
  event.returnValue = "";
}

function showControlsForStartup() {
  controlsVisible.value = true;
  if (!userPreferences.value.hideControlsAutomatically) return;
  if (controlsHideTimeout !== undefined) window.clearTimeout(controlsHideTimeout);
  controlsHideTimeout = window.setTimeout(() => { controlsVisible.value = false; }, 2400);
}

function returnToEditor() {
  settingsOpen.value = false;
  cancelCountdown();
  stopRecording();
  stopPlayback();
  screen.value = "editor";
}

function advance() {
  if (timingMode.value === "manual" && isRecording.value) {
    recordCurrentWord();
    return;
  }
  if (timingMode.value === "manual" && manualSession.value.status === "ready") return;
  playback.next();
}

function retreat() {
  if (isRecording.value) {
    const previousCursor = manualSession.value.cursor;
    manualSession.value = retreatManualRecording(manualSession.value, performance.now());
    if (manualSession.value.cursor !== previousCursor) hasUnsavedChanges.value = true;
    project.value = { ...project.value, manualTimings: manualSession.value.timings };
    playback.seek(manualSession.value.cursor);
    return;
  }
  stopRecording();
  playback.previous();
}

function runWithCountdown(action: () => void) {
  cancelCountdown();
  const seconds = userPreferences.value.countdownSeconds;
  if (seconds <= 0) {
    action();
    return;
  }
  countdown.value = seconds;
  countdownTimer = window.setInterval(() => {
    if (countdown.value === null || countdown.value <= 1) {
      cancelCountdown();
      action();
    } else {
      countdown.value -= 1;
    }
  }, 1000);
}

function cancelCountdown() {
  if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
  countdownTimer = undefined;
  countdown.value = null;
}

function beginRecording() {
  if (!words.value.length) return;
  stopPlayback();
  manualSession.value = startManualRecording(createManualRecordingSession(words.value.length), performance.now());
  project.value = { ...project.value, timingMode: "manual", manualTimings: [] };
  hasUnsavedChanges.value = true;
  playback.restart();
  showNotice("Grabando. Lee la palabra blanca y pulsa → al terminar.");
}

function toggleRecording() {
  if (isRecording.value) {
    stopRecording(true);
    return;
  }
  if (countdown.value !== null) {
    cancelCountdown();
    return;
  }
  runWithCountdown(beginRecording);
}

function recordCurrentWord() {
  if (!isRecording.value) {
    stopRecording();
    return;
  }
  manualSession.value = advanceManualRecording(manualSession.value, performance.now());
  project.value = { ...project.value, manualTimings: manualSession.value.timings };
  hasUnsavedChanges.value = true;
  playback.seek(manualSession.value.cursor);
  if (manualSession.value.status === "review") showNotice("Ritmo manual grabado. Puedes revisar, reproducir o volver a grabar.");
}

function stopRecording(captureCurrentWord = false) {
  if (!isRecording.value) return;
  manualSession.value = captureCurrentWord
    ? finishManualRecording(manualSession.value, performance.now())
    : { ...manualSession.value, status: "review", lastAdvanceAt: null };
  project.value = { ...project.value, manualTimings: manualSession.value.timings };
  hasUnsavedChanges.value = true;
  playback.seek(manualSession.value.cursor);
  if (captureCurrentWord) showNotice("Grabación detenida. Puedes revisar, editar o reproducir el ritmo registrado.");
}

function togglePlayback() {
  if (isPlaying.value) {
    stopPlayback();
    return;
  }
  if (countdown.value !== null) {
    cancelCountdown();
    return;
  }
  if (isRecording.value) stopRecording();
  if (!words.value.length) return;
  if (timingMode.value === "manual" && !project.value.manualTimings.length) {
    showNotice("Graba primero tu ritmo con el botón RECORD.");
    return;
  }
  runWithCountdown(playback.play);
}

function playbackDuration(word: ReadingWord): number {
  if (timingMode.value === "automatic") return word.durationMilliseconds;
  const fallback = automaticWords.value[word.sourceTokenIndex]?.durationMilliseconds ?? 500;
  return manualWordDuration(project.value.manualTimings, word.sourceTokenIndex, fallback);
}

function stopPlayback() {
  playback.pause();
}

function seekFromProgress(event: Event) {
  playback.seek(Number((event.target as HTMLInputElement).value));
}

function adjustFontSize(amount: number) {
  project.value.teleprompterSettings.fontSize = Math.max(30, Math.min(96, project.value.teleprompterSettings.fontSize + amount));
  hasUnsavedChanges.value = true;
}

function updateTheme(value: UserPreferences["theme"]) { userPreferences.value.theme = value; }
function updateLanguage(value: Language) { userPreferences.value.defaultLanguage = value; }
function selectProjectLanguage(value: Language) {
  if (project.value.automaticTiming.language !== value) hasUnsavedChanges.value = true;
  project.value.automaticTiming.language = value;
}
function updateWordsPerMinute(value: number) { userPreferences.value.defaultWordsPerMinute = value; }
function updateProjectWordsPerMinute(value: number) {
  if (project.value.automaticTiming.wordsPerMinute !== value) hasUnsavedChanges.value = true;
  project.value.automaticTiming.wordsPerMinute = value;
}
function updateFontSize(value: number) { userPreferences.value.defaultFontSize = value; }

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await appRoot.value?.requestFullscreen();
  } catch {
    showNotice("El sistema no permitió cambiar a pantalla completa.");
  }
}
</script>

<template>
  <main
    ref="appRoot"
    class="app-shell"
    :class="[`screen-${screen}`, `theme-${userPreferences.theme}`, { 'controls-visible': controlsVisible }]"
    :style="{ '--prompter-font-size': `${project.teleprompterSettings.fontSize}px` }"
  >
    <div
      v-if="!appReady"
      class="startup-shield"
      role="status"
      aria-live="polite"
    >
      Preparando ScriptArc…
    </div>
    <template v-if="screen === 'editor'">
      <header class="topbar">
        <a
          class="brand"
          href="#"
          aria-label="ScriptArc inicio"
          @click.prevent="returnToEditor"
        >
          <span
            class="brand-mark"
            aria-hidden="true"
          >s</span>
          <span>ScriptArc</span>
        </a>
        <span
          class="project-status"
          :title="filePath ?? 'Proyecto todavía no guardado'"
        >{{ displayFileName }}{{ hasUnsavedChanges ? " •" : "" }}</span>
        <button
          class="icon-button"
          type="button"
          aria-label="Configuración"
          title="Configuración"
          :aria-expanded="settingsOpen"
          @click="settingsOpen = !settingsOpen"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </header>
      <SettingsPanel
        v-if="settingsOpen"
        :theme="userPreferences.theme"
        :language="userPreferences.defaultLanguage"
        :words-per-minute="userPreferences.defaultWordsPerMinute"
        :font-size="userPreferences.defaultFontSize"
        :countdown-seconds="userPreferences.countdownSeconds"
        :hide-controls-automatically="userPreferences.hideControlsAutomatically"
        @update:theme="updateTheme"
        @update:language="updateLanguage"
        @update:words-per-minute="updateWordsPerMinute"
        @update:font-size="updateFontSize"
        @update:countdown-seconds="userPreferences.countdownSeconds = $event"
        @update:hide-controls-automatically="userPreferences.hideControlsAutomatically = $event"
        @close="settingsOpen = false"
      />

      <section
        class="editor-view"
        aria-label="Editor de guion"
      >
        <div class="editor-heading">
          <p class="eyebrow">
            Tu próximo guion empieza aquí
          </p>
          <h1>Escribe con claridad.<br><span>Lee con confianza.</span></h1>
          <p class="document-title">
            {{ project.title }}
          </p>
        </div>

        <ScriptEditor v-model="sourceMarkdown" />

        <div class="editor-actions">
          <div class="primary-actions">
            <button
              class="button button-primary"
              type="button"
              :disabled="!sourceMarkdown.trim()"
              :aria-expanded="automaticLanguagePicker"
              @click="automaticLanguagePicker = !automaticLanguagePicker"
            >
              Automático <span aria-hidden="true">→</span>
            </button>
            <button
              class="button button-secondary"
              type="button"
              :disabled="!sourceMarkdown.trim()"
              @click="start('manual')"
            >
              Manual
            </button>
          </div>
          <div class="file-actions">
            <button
              class="text-button"
              type="button"
              @click="createNewProject"
            >
              Nuevo
            </button>
            <button
              class="text-button"
              type="button"
              @click="openProject"
            >
              Abrir proyecto
            </button>
            <button
              class="text-button"
              type="button"
              :disabled="!hasUnsavedChanges && filePath !== null"
              @click="saveProject()"
            >
              Guardar
            </button>
            <button
              class="text-button"
              type="button"
              @click="saveProject(true)"
            >
              Guardar como…
            </button>
          </div>
        </div>
        <div
          v-if="automaticLanguagePicker"
          class="language-choice"
        >
          <label>
            <span>Idioma para leer los números</span>
            <select
              :value="project.automaticTiming.language"
              @change="selectProjectLanguage(($event.target as HTMLSelectElement).value as Language)"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
          <label class="settings-range project-speed">
            <span><span>Ritmo de este guion</span><output>{{ project.automaticTiming.wordsPerMinute }} palabras/min</output></span>
            <input
              type="range"
              min="80"
              max="240"
              step="5"
              :value="project.automaticTiming.wordsPerMinute"
              aria-label="Ritmo automático de este guion"
              @input="updateProjectWordsPerMinute(Number(($event.target as HTMLInputElement).value))"
            >
          </label>
          <button
            class="button button-primary"
            type="button"
            @click="start('automatic')"
          >
            Empezar <span aria-hidden="true">→</span>
          </button>
        </div>
        <p class="editor-hint">
          Pega o escribe tu texto; tus palabras siempre se quedan contigo.
        </p>
        <p
          class="notice"
          role="status"
          aria-live="polite"
        >
          {{ notice }}
        </p>
      </section>
      <footer class="app-footer">
        <span>Hecho para que tus ideas fluyan.</span>
      </footer>
    </template>

    <template v-else>
      <header
        class="prompter-toolbar"
        :class="{ 'controls-hidden': !controlsVisible }"
      >
        <button
          class="text-button"
          type="button"
          @click="returnToEditor"
        >
          ← Editor
        </button>
        <span class="mode-label">
          {{ timingMode === "automatic" ? "Modo automático" : "Modo manual" }}{{ isRecording ? " · Grabando" : "" }}
        </span>
        <button
          class="icon-button"
          type="button"
          aria-label="Configuración"
          title="Configuración"
          :aria-expanded="settingsOpen"
          @click="settingsOpen = !settingsOpen"
        >
          ⚙
        </button>
      </header>
      <SettingsPanel
        v-if="settingsOpen"
        :theme="userPreferences.theme"
        :language="userPreferences.defaultLanguage"
        :words-per-minute="userPreferences.defaultWordsPerMinute"
        :font-size="userPreferences.defaultFontSize"
        :countdown-seconds="userPreferences.countdownSeconds"
        :hide-controls-automatically="userPreferences.hideControlsAutomatically"
        @update:theme="updateTheme"
        @update:language="updateLanguage"
        @update:words-per-minute="updateWordsPerMinute"
        @update:font-size="updateFontSize"
        @update:countdown-seconds="userPreferences.countdownSeconds = $event"
        @update:hide-controls-automatically="userPreferences.hideControlsAutomatically = $event"
        @close="settingsOpen = false"
      />
      <div
        v-if="countdown !== null"
        class="countdown-overlay"
        role="status"
        aria-live="assertive"
      >
        <span>Comenzamos en</span>
        <strong>{{ countdown }}</strong>
        <button
          class="button button-secondary"
          type="button"
          @click="cancelCountdown"
        >
          Cancelar
        </button>
      </div>
      <TeleprompterText
        :blocks="parsedMarkdown.blocks"
        :words="words"
        :cursor="cursor"
      />
      <p
        class="notice notice-dark"
        role="status"
        aria-live="polite"
      >
        {{ notice }}
      </p>
      <footer
        class="prompter-controls"
        :class="{ 'controls-hidden': !controlsVisible }"
        aria-label="Controles del teleprompter"
      >
        <div class="playback-progress">
          <span>{{ formatPlaybackTime(elapsedMilliseconds) }}</span>
          <input
            class="progress-slider"
            type="range"
            min="0"
            :max="words.length"
            :value="cursor"
            :style="{ '--progress': `${progressPercent}%` }"
            :disabled="isRecording || (timingMode === 'manual' && manualSession.status === 'ready')"
            aria-label="Progreso de lectura"
            @input="seekFromProgress"
          >
          <span>-{{ formatPlaybackTime(remainingMilliseconds) }}</span>
        </div>
        <p
          v-if="timingMode === 'manual'"
          class="manual-instruction"
        >
          {{ isRecording ? "Lee la palabra blanca y pulsa → al terminarla; ← vuelve una palabra y permite repetirla." : manualSession.status === "review" ? "Grabación lista para revisar o reproducir; RECORD vuelve a empezar." : "Sitúate en la primera palabra y pulsa RECORD para medir tu ritmo." }}
        </p>
        <div class="control-buttons">
          <button
            class="button button-secondary"
            type="button"
            aria-label="Reiniciar"
            title="Reiniciar (Inicio)"
            :disabled="isRecording || countdown !== null"
            @click="playback.restart"
          >
            ↺
          </button>
          <button
            class="button button-secondary"
            type="button"
            aria-label="Palabra anterior"
            title="Anterior (←)"
            @click="retreat"
          >
            ←
          </button>
          <button
            v-if="timingMode === 'manual'"
            class="button button-secondary playback-button"
            :class="{ 'recording-button': isRecording }"
            type="button"
            :disabled="!words.length || countdown !== null"
            @click="toggleRecording"
          >
            {{ isRecording ? "■ DETENER" : manualSession.status === "review" ? "● REGRABAR" : "● RECORD" }}
          </button>
          <button
            v-if="timingMode === 'automatic' || project.manualTimings.length > 0"
            class="button button-secondary playback-button"
            type="button"
            :disabled="!words.length || (timingMode === 'manual' && (!project.manualTimings.length || isRecording))"
            @click="togglePlayback"
          >
            {{ isPlaying ? "Pausa" : "Play" }}
          </button>
          <button
            class="button button-secondary"
            type="button"
            aria-label="Siguiente palabra"
            title="Siguiente (→)"
            @click="advance"
          >
            →
          </button>
          <button
            class="button button-secondary font-button"
            type="button"
            aria-label="Reducir tamaño de letra"
            @click="adjustFontSize(-4)"
          >
            A−
          </button>
          <button
            class="button button-secondary font-button"
            type="button"
            aria-label="Aumentar tamaño de letra"
            @click="adjustFontSize(4)"
          >
            A+
          </button>
          <button
            class="button button-secondary"
            type="button"
            :aria-label="isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'"
            :title="isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'"
            @click="toggleFullscreen"
          >
            {{ isFullscreen ? "⤢" : "⛶" }}
          </button>
        </div>
      </footer>
    </template>

    <div
      v-if="unsavedDialogOpen"
      class="dialog-backdrop"
      role="presentation"
    >
      <section
        class="unsaved-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-dialog-title"
        aria-describedby="unsaved-dialog-description"
        @keydown="handleUnsavedDialogKeydown"
      >
        <h2 id="unsaved-dialog-title">
          Cambios sin guardar
        </h2>
        <p id="unsaved-dialog-description">
          ¿Quieres guardar los cambios de {{ displayFileName }} antes de continuar?
        </p>
        <div class="dialog-actions">
          <button
            ref="cancelDialogButton"
            class="button button-secondary"
            type="button"
            @click="resolveUnsavedChoice('cancel')"
          >
            Cancelar
          </button>
          <button
            class="button button-secondary"
            type="button"
            @click="resolveUnsavedChoice('discard')"
          >
            No guardar
          </button>
          <button
            class="button button-primary"
            type="button"
            @click="resolveUnsavedChoice('save')"
          >
            Guardar
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
