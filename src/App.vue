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
import { translate, translateErrorMessage, type UiTextKey } from "./shared/localization";
import { usePlayback } from "./features/teleprompter/usePlayback";
import type { CustomTheme, Language, PresetThemeId, ReadingWord, ThemeId, TimingMode, UserPreferences } from "./shared/types";
import { THEME_PALETTES } from "./features/settings/themes";

type Screen = "editor" | "teleprompter";
type UnsavedChoice = "save" | "discard" | "cancel";

const screen = ref<Screen>("editor");
const userPreferences = ref(loadUserPreferences());
const t = (key: UiTextKey, values: Record<string, string | number> = {}) => translate(userPreferences.value.interfaceLanguage, key, values);
const project = ref(createProject("", new Date(), userPreferences.value));
const filePath = ref<string | null>(null);
const savedFingerprint = ref(projectFingerprint(project.value));
const hasUnsavedChanges = ref(false);
const displayFileName = computed(() => filePath.value?.split(/[\\/]/u).pop() ?? t("unsavedProject"));
const appStyle = computed(() => {
  const theme = userPreferences.value.theme;
  const palette = theme.startsWith("custom:")
    ? userPreferences.value.customThemes.find(({ id }) => id === theme.slice("custom:".length))?.palette ?? THEME_PALETTES.white
    : THEME_PALETTES[theme as PresetThemeId];
  return {
    "--prompter-font-size": `${project.value.teleprompterSettings.fontSize}px`,
    "--surface": palette.surface,
    "--surface-muted": palette.surfaceMuted,
    "--text": palette.text,
    "--text-soft": palette.textSoft,
    "--line": palette.line,
    "--accent": palette.accent,
    "--accent-soft": palette.accentSoft,
    "--prompter-bg": palette.prompterBg,
    "--prompter-muted": palette.prompterMuted,
    "--prompter-text-color": palette.prompterTextColor,
    "--prompter-current-color": palette.prompterCurrentColor,
    "--prompter-spoken-color": palette.prompterSpokenColor,
  };
});
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
    if (sourceChanged && hadTimings) showNotice(t("manualTimingsDiscarded"));
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
const countdownPurpose = ref<"playback" | "recording" | null>(null);
const appReady = ref(false);
const unsavedDialogOpen = ref(false);
let unsavedChoiceResolver: ((choice: UnsavedChoice) => void) | null = null;
let allowWindowClose = false;
let closeListener: (() => void) | undefined;
let noticeTimeout: number | undefined;
let controlsHideTimeout: number | undefined;
let countdownTimer: number | undefined;
let pendingCountdownAction: (() => void) | null = null;
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
    showNotice(t("preferencesUnavailable"));
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
    showNotice(t("recoverySaveFailed"));
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
    showNotice(t("openNotice", { title: opened.project.title }));
  } catch (error) {
    showNotice(error instanceof Error ? translateErrorMessage(error.message, userPreferences.value.interfaceLanguage) : t("noProjectOpen"));
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
    showNotice(t("saveNotice"));
    return true;
  } catch (error) {
    showNotice(error instanceof Error ? translateErrorMessage(error.message, userPreferences.value.interfaceLanguage) : t("saveFailed"));
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
  if (countdown.value !== null) {
    if (event.key === "Escape") cancelCountdown();
    else if (event.key === " " || event.key === "ArrowRight") {
      event.preventDefault();
      skipCountdown();
    }
    return;
  }
  const target = event.target;
  if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true'], button")) return;

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
      if (document.fullscreenElement) {
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
      ? await ask(t("restorePrompt"), { title: t("restoreTitle"), kind: "warning" })
      : window.confirm(t("restorePrompt"));
    if (shouldRestore) {
      validateManualTimingIndices(recovery.project);
      project.value = recovery.project;
      filePath.value = recovery.filePath;
      savedFingerprint.value = recovery.baselineFingerprint;
      hasUnsavedChanges.value = true;
      manualSession.value = createManualRecordingSession(parseMarkdown(recovery.project.sourceMarkdown).tokens.length, recovery.project.manualTimings);
      playback.seek(recovery.project.lastPosition);
      showNotice(t("recoveryRestored"));
    } else {
      clearRecoveryDraft();
    }
  } catch (error) {
    showNotice(error instanceof Error ? translateErrorMessage(error.message, userPreferences.value.interfaceLanguage) : t("prepareFailed"));
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

function runWithCountdown(action: () => void, purpose: "playback" | "recording", seconds = userPreferences.value.countdownSeconds) {
  cancelCountdown();
  if (seconds <= 0) {
    action();
    return;
  }
  pendingCountdownAction = action;
  countdownPurpose.value = purpose;
  countdown.value = seconds;
  countdownTimer = window.setInterval(() => {
    if (countdown.value === null || countdown.value <= 1) {
      completeCountdown();
    } else {
      countdown.value -= 1;
    }
  }, 1000);
}

function cancelCountdown() {
  if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
  countdownTimer = undefined;
  countdown.value = null;
  countdownPurpose.value = null;
  pendingCountdownAction = null;
}

function skipCountdown() {
  if (countdown.value !== null) completeCountdown();
}

function completeCountdown() {
  if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
  countdownTimer = undefined;
  countdown.value = null;
  countdownPurpose.value = null;
  const action = pendingCountdownAction;
  pendingCountdownAction = null;
  action?.();
}

function beginRecording() {
  if (!words.value.length) return;
  stopPlayback();
  manualSession.value = startManualRecording(createManualRecordingSession(words.value.length), performance.now());
  project.value = { ...project.value, timingMode: "manual", manualTimings: [] };
  hasUnsavedChanges.value = true;
  playback.restart();
  showNotice(t("recordingStarted"));
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
  runWithCountdown(beginRecording, "recording");
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
  if (manualSession.value.status === "review") showNotice(t("recordingDone"));
}

function stopRecording(captureCurrentWord = false) {
  if (!isRecording.value) return;
  manualSession.value = captureCurrentWord
    ? finishManualRecording(manualSession.value, performance.now())
    : { ...manualSession.value, status: "review", lastAdvanceAt: null };
  project.value = { ...project.value, manualTimings: manualSession.value.timings };
  hasUnsavedChanges.value = true;
  playback.seek(manualSession.value.cursor);
  if (captureCurrentWord) showNotice(t("recordingStopped"));
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
    showNotice(t("recordFirst"));
    return;
  }
  if (userPreferences.value.playbackCountdownEnabled) {
    runWithCountdown(playback.play, "playback", userPreferences.value.playbackCountdownSeconds);
  } else {
    playback.play();
  }
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
  playback.seekToProgress(Number((event.target as HTMLInputElement).value));
}

function adjustFontSize(amount: number) {
  project.value.teleprompterSettings.fontSize = Math.max(30, Math.min(96, project.value.teleprompterSettings.fontSize + amount));
  hasUnsavedChanges.value = true;
}

function updateTheme(value: ThemeId) { userPreferences.value.theme = value; }
function createCustomTheme(value: { name: string; baseTheme: PresetThemeId }) {
  const id = globalThis.crypto?.randomUUID?.() ?? `theme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const theme: CustomTheme = { id, name: value.name.trim().slice(0, 60), baseTheme: value.baseTheme, palette: { ...THEME_PALETTES[value.baseTheme] } };
  userPreferences.value.customThemes = [...userPreferences.value.customThemes, theme];
  userPreferences.value.theme = `custom:${id}`;
}
function updateCustomTheme(value: CustomTheme) {
  userPreferences.value.customThemes = userPreferences.value.customThemes.map((theme) => theme.id === value.id ? value : theme);
}
function deleteCustomTheme(id: string) {
  const removed = userPreferences.value.customThemes.find((theme) => theme.id === id);
  userPreferences.value.customThemes = userPreferences.value.customThemes.filter((theme) => theme.id !== id);
  if (userPreferences.value.theme === `custom:${id}`) userPreferences.value.theme = removed?.baseTheme ?? "white";
}
function updateInterfaceLanguage(value: Language) { userPreferences.value.interfaceLanguage = value; }
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
    showNotice(t("fullscreenError"));
  }
}
</script>

<template>
  <main
    ref="appRoot"
    class="app-shell"
    :class="[`screen-${screen}`, { 'controls-visible': controlsVisible }]"
    :style="appStyle"
  >
    <div
      v-if="!appReady"
      class="startup-shield"
      role="status"
      aria-live="polite"
    >
      {{ t('startup') }}
    </div>
    <template v-if="screen === 'editor'">
      <button
        class="icon-button settings-floating-button"
        type="button"
        :aria-label="t('settings')"
        :title="t('settings')"
        :aria-expanded="settingsOpen"
        @click="settingsOpen = !settingsOpen"
      >
        <span aria-hidden="true">⚙</span>
      </button>
      <SettingsPanel
        v-if="settingsOpen"
        :interface-language="userPreferences.interfaceLanguage"
        :theme="userPreferences.theme"
        :custom-themes="userPreferences.customThemes"
        :language="userPreferences.defaultLanguage"
        :words-per-minute="userPreferences.defaultWordsPerMinute"
        :font-size="userPreferences.defaultFontSize"
        :countdown-seconds="userPreferences.countdownSeconds"
        :hide-controls-automatically="userPreferences.hideControlsAutomatically"
        @update:interface-language="updateInterfaceLanguage"
        @update:theme="updateTheme"
        @create:custom-theme="createCustomTheme"
        @update:custom-theme="updateCustomTheme"
        @delete:custom-theme="deleteCustomTheme"
        @update:language="updateLanguage"
        @update:words-per-minute="updateWordsPerMinute"
        @update:font-size="updateFontSize"
        @update:countdown-seconds="userPreferences.countdownSeconds = $event"
        @update:hide-controls-automatically="userPreferences.hideControlsAutomatically = $event"
        @close="settingsOpen = false"
      />

      <section
        class="editor-view"
        :aria-label="t('editorAria')"
      >
        <div class="editor-heading">
          <p class="eyebrow">
            {{ t('eyebrow') }}
          </p>
          <h1>{{ t('writeClearly') }}<br><span>{{ t('readConfidently') }}</span></h1>
          <p class="document-title">
            {{ project.sourceMarkdown.trim() ? project.title : t('untitledScript') }}
          </p>
        </div>

        <ScriptEditor
          v-model="sourceMarkdown"
          :interface-language="userPreferences.interfaceLanguage"
        />

        <div class="editor-actions">
          <div class="primary-actions">
            <button
              class="button button-primary"
              type="button"
              :disabled="!sourceMarkdown.trim()"
              :aria-expanded="automaticLanguagePicker"
              @click="automaticLanguagePicker = !automaticLanguagePicker"
            >
              {{ t('automatic') }} <span aria-hidden="true">→</span>
            </button>
            <button
              class="button button-secondary"
              type="button"
              :disabled="!sourceMarkdown.trim()"
              @click="start('manual')"
            >
              {{ t('manual') }}
            </button>
          </div>
          <div class="file-actions">
            <button
              class="text-button"
              type="button"
              @click="createNewProject"
            >
              {{ t('newProject') }}
            </button>
            <button
              class="text-button"
              type="button"
              @click="openProject"
            >
              {{ t('openProject') }}
            </button>
            <button
              class="text-button"
              type="button"
              :disabled="!hasUnsavedChanges && filePath !== null"
              @click="saveProject()"
            >
              {{ t('save') }}
            </button>
            <button
              class="text-button"
              type="button"
              @click="saveProject(true)"
            >
              {{ t('saveAs') }}
            </button>
          </div>
        </div>
        <div
          v-if="automaticLanguagePicker"
          class="language-choice"
        >
          <label>
            <span>{{ t('numberLanguage') }}</span>
            <select
              :value="project.automaticTiming.language"
              @change="selectProjectLanguage(($event.target as HTMLSelectElement).value as Language)"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
          <label class="settings-range project-speed">
            <span><span>{{ t('projectPace') }}</span><output>{{ project.automaticTiming.wordsPerMinute }} {{ t('wordsPerMinute') }}</output></span>
            <input
              type="range"
              min="80"
              max="240"
              step="5"
              :value="project.automaticTiming.wordsPerMinute"
              :aria-label="t('projectPace')"
              @input="updateProjectWordsPerMinute(Number(($event.target as HTMLInputElement).value))"
            >
          </label>
          <button
            class="button button-primary"
            type="button"
            @click="start('automatic')"
          >
            {{ t('start') }} <span aria-hidden="true">→</span>
          </button>
        </div>
        <p class="editor-hint">
          {{ t('editorHint') }}
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
        <span>{{ t('footer') }}</span>
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
          {{ t('editorButton') }}
        </button>
        <span class="mode-label">
          {{ timingMode === "automatic" ? t('autoMode') : t('manualMode') }}{{ isRecording ? ` · ${t('recording')}` : "" }}
        </span>
        <button
          class="icon-button"
          type="button"
          :aria-label="t('settings')"
          :title="t('settings')"
          :aria-expanded="settingsOpen"
          @click="settingsOpen = !settingsOpen"
        >
          ⚙
        </button>
      </header>
      <SettingsPanel
        v-if="settingsOpen"
        :interface-language="userPreferences.interfaceLanguage"
        :theme="userPreferences.theme"
        :custom-themes="userPreferences.customThemes"
        :language="userPreferences.defaultLanguage"
        :words-per-minute="userPreferences.defaultWordsPerMinute"
        :font-size="userPreferences.defaultFontSize"
        :countdown-seconds="userPreferences.countdownSeconds"
        :hide-controls-automatically="userPreferences.hideControlsAutomatically"
        @update:interface-language="updateInterfaceLanguage"
        @update:theme="updateTheme"
        @create:custom-theme="createCustomTheme"
        @update:custom-theme="updateCustomTheme"
        @delete:custom-theme="deleteCustomTheme"
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
        <span>{{ countdownPurpose === "recording" ? t('preparingRecording') : t('startingSoon') }}</span>
        <strong>{{ countdown }}</strong>
        <p
          v-if="countdownPurpose === 'recording'"
          class="countdown-key-hint"
        >
          <span>{{ t('skipCountdownWith') }}</span>
          <kbd
            role="img"
            :aria-label="t('keyArrowRight')"
          >→</kbd>
          <kbd
            class="keycap-space"
            role="img"
            :aria-label="t('keySpace')"
          ><span aria-hidden="true" /></kbd>
        </p>
        <button
          class="button button-secondary"
          type="button"
          @click="skipCountdown"
        >
          {{ t('skip') }}
        </button>
      </div>
      <TeleprompterText
        :blocks="parsedMarkdown.blocks"
        :words="words"
        :cursor="cursor"
        :interface-language="userPreferences.interfaceLanguage"
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
        :aria-label="t('controls')"
      >
        <div class="playback-progress">
          <span>{{ formatPlaybackTime(elapsedMilliseconds) }}</span>
          <input
            class="progress-slider"
            type="range"
            min="0"
            max="100"
            step="0.1"
            :value="progressPercent"
            :style="{ '--progress': `${progressPercent}%` }"
            :disabled="isRecording || (timingMode === 'manual' && manualSession.status === 'ready')"
            :aria-label="t('readingProgress')"
            @input="seekFromProgress"
          >
          <span>-{{ formatPlaybackTime(remainingMilliseconds) }}</span>
          <div class="playback-countdown-control">
            <button
              class="countdown-toggle"
              type="button"
              :aria-label="userPreferences.playbackCountdownEnabled ? t('disablePlaybackCountdown') : t('enablePlaybackCountdown')"
              :title="t('playbackCountdownControl')"
              :aria-pressed="userPreferences.playbackCountdownEnabled"
              @click="userPreferences.playbackCountdownEnabled = !userPreferences.playbackCountdownEnabled"
            >
              ⏱
            </button>
            <select
              :value="userPreferences.playbackCountdownSeconds"
              :aria-label="t('playbackCountdownDuration')"
              :title="t('playbackCountdownDuration')"
              @change="userPreferences.playbackCountdownSeconds = Number(($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="seconds in 10"
                :key="seconds"
                :value="seconds"
              >
                {{ seconds }}{{ t('secondsShort') }}
              </option>
            </select>
          </div>
        </div>
        <p
          v-if="timingMode === 'manual' && manualSession.status !== 'review'"
          class="manual-instruction"
        >
          <template v-if="isRecording">
            {{ t('advanceWord') }}
            <kbd
              role="img"
              :aria-label="t('keyArrowRight')"
            >→</kbd>
            <kbd
              class="keycap-space"
              role="img"
              :aria-label="t('keySpace')"
            ><span aria-hidden="true" /></kbd>
            <span class="keystroke-separator">·</span>
            {{ t('retreatWord') }} <kbd
              role="img"
              :aria-label="t('keyArrowLeft')"
            >←</kbd>
          </template>
          <template v-else>
            {{ t('startRecordingHint') }}
            <kbd
              role="img"
              :aria-label="t('keyArrowRight')"
            >→</kbd>
            <kbd
              class="keycap-space"
              role="img"
              :aria-label="t('keySpace')"
            ><span aria-hidden="true" /></kbd>
          </template>
        </p>
        <div class="control-buttons">
          <button
            class="button button-secondary"
            type="button"
            :aria-label="t('restart')"
            :title="`${t('restart')} (Home)`"
            :disabled="isRecording || countdown !== null"
            @click="playback.restart"
          >
            ↺
          </button>
          <button
            class="button button-secondary"
            type="button"
            :aria-label="t('previousWord')"
            :title="`${t('previousWord')} (←)`"
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
            {{ isRecording ? t('stopRecording') : manualSession.status === "review" ? t('rerecord') : t('record') }}
          </button>
          <button
            v-if="timingMode === 'automatic' || project.manualTimings.length > 0"
            class="button button-secondary playback-button"
            type="button"
            :disabled="!words.length || (timingMode === 'manual' && (!project.manualTimings.length || isRecording))"
            @click="togglePlayback"
          >
            {{ isPlaying ? t('pause') : t('play') }}
          </button>
          <button
            class="button button-secondary"
            type="button"
            :aria-label="t('nextWord')"
            :title="`${t('nextWord')} (→)`"
            @click="advance"
          >
            →
          </button>
          <button
            class="button button-secondary font-button"
            type="button"
            :aria-label="t('decreaseFont')"
            @click="adjustFontSize(-4)"
          >
            A−
          </button>
          <button
            class="button button-secondary font-button"
            type="button"
            :aria-label="t('increaseFont')"
            @click="adjustFontSize(4)"
          >
            A+
          </button>
          <button
            class="button button-secondary"
            type="button"
            :aria-label="isFullscreen ? t('exitFullscreen') : t('fullscreen')"
            :title="isFullscreen ? t('exitFullscreenShortcut') : t('fullscreenShortcut')"
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
          {{ t('unsavedTitle') }}
        </h2>
        <p id="unsaved-dialog-description">
          {{ t('unsavedDescription', { name: displayFileName }) }}
        </p>
        <div class="dialog-actions">
          <button
            ref="cancelDialogButton"
            class="button button-secondary"
            type="button"
            @click="resolveUnsavedChoice('cancel')"
          >
            {{ t('cancel') }}
          </button>
          <button
            class="button button-secondary"
            type="button"
            @click="resolveUnsavedChoice('discard')"
          >
            {{ t('discard') }}
          </button>
          <button
            class="button button-primary"
            type="button"
            @click="resolveUnsavedChoice('save')"
          >
            {{ t('save') }}
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
