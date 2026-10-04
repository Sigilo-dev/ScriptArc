<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isTauri } from "@tauri-apps/api/core";
import ScriptEditor from "./features/editor/ScriptEditor.vue";
import { parseMarkdown } from "./features/markdown/parseMarkdown";
import { createProject, updateProjectMarkdown } from "./features/project/projectModel";
import { loadLocalProject, openProjectFile, saveLocalProject, saveProjectFile } from "./features/project/projectPersistence";
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
import TeleprompterText from "./features/teleprompter/TeleprompterText.vue";
import { formatPlaybackTime } from "./features/teleprompter/playbackState";
import { usePlayback } from "./features/teleprompter/usePlayback";
import type { ReadingWord, TimingMode } from "./shared/types";

type Screen = "editor" | "teleprompter";

const screen = ref<Screen>("editor");
const project = ref(loadLocalProject() ?? createProject());
const sourceMarkdown = computed({
  get: () => project.value.sourceMarkdown,
  set: (markdown: string) => {
    const hadTimings = project.value.manualTimings.length > 0;
    const sourceChanged = markdown !== project.value.sourceMarkdown;
    project.value = updateProjectMarkdown(project.value, markdown);
    if (sourceChanged && hadTimings) showNotice("El texto cambió; los tiempos manuales se eliminaron para evitar asignarlos a otras palabras.");
  },
});
const timingMode = computed(() => project.value.timingMode);
const manualSession = ref(createManualRecordingSession(0));
const isRecording = computed(() => manualSession.value.status === "recording");
const parsedMarkdown = computed(() => parseMarkdown(sourceMarkdown.value));
const automaticWords = computed(() => createAutomaticReadingWords(parsedMarkdown.value, project.value.automaticTiming, project.value.preferences.wordsPerMinute));
const words = computed<ReadingWord[]>(() => timingMode.value === "automatic"
  ? automaticWords.value
  : parsedMarkdown.value.tokens.map((token) => ({ ...token, sourceTokenIndex: token.index, durationMilliseconds: 0 })));
const playback = usePlayback(words, playbackDuration);
const { cursor, isPlaying, elapsedMilliseconds, remainingMilliseconds, progressPercent } = playback;
const filePath = ref<string | null>(null);
const notice = ref("");
const settingsOpen = ref(false);
const automaticLanguagePicker = ref(false);
const appRoot = ref<HTMLElement | null>(null);
const controlsVisible = ref(true);
const isFullscreen = ref(false);
let noticeTimeout: number | undefined;
let controlsHideTimeout: number | undefined;

watch(project, (value) => {
  try {
    saveLocalProject(value);
  } catch {
    showNotice("No se pudo guardar el borrador local.");
  }
}, { deep: true });

function start(mode: TimingMode) {
  settingsOpen.value = false;
  automaticLanguagePicker.value = false;
  stopRecording();
  stopPlayback();
  project.value = { ...project.value, timingMode: mode };
  manualSession.value = createManualRecordingSession(mode === "manual" ? parsedMarkdown.value.tokens.length : 0, project.value.manualTimings);
  playback.restart();
  screen.value = "teleprompter";
  showControlsForStartup();
}

function showNotice(message: string) {
  notice.value = message;
  if (noticeTimeout !== undefined) window.clearTimeout(noticeTimeout);
  noticeTimeout = window.setTimeout(() => { notice.value = ""; }, 3500);
}

async function openProject() {
  try {
    const opened = await openProjectFile();
    if (!opened) return;
    stopRecording();
    stopPlayback();
    project.value = opened.project;
    manualSession.value = createManualRecordingSession(parseMarkdown(opened.project.sourceMarkdown).tokens.length, opened.project.manualTimings);
    settingsOpen.value = false;
    filePath.value = opened.filePath;
    playback.restart();
    showNotice(`Proyecto abierto: ${opened.project.title}`);
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo abrir el proyecto.");
  }
}

async function saveProject() {
  try {
    const updated = { ...project.value, updatedAt: new Date().toISOString() };
    const savedPath = await saveProjectFile(updated, filePath.value);
    if (isTauri() && !savedPath) return;
    project.value = updated;
    filePath.value = savedPath ?? filePath.value;
    showNotice("Proyecto guardado en este dispositivo.");
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo guardar el proyecto.");
  }
}

function handlePrompterKey(event: KeyboardEvent) {
  if (screen.value !== "teleprompter") return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
  if (event.key === " " && target instanceof HTMLElement && target.closest("button")) return;

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
      if (!isRecording.value && !(timingMode.value === "manual" && manualSession.value.status === "ready")) {
        playback.seek(words.value.length - 1);
      }
      break;
    case "Escape":
      if (document.fullscreenElement) {
        event.preventDefault();
        void document.exitFullscreen();
      } else if (!isFullscreen.value) {
        returnToEditor();
      }
      break;
  }
}

function handlePrompterPointer(event: MouseEvent) {
  if (screen.value !== "teleprompter") return;
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

onMounted(() => {
  window.addEventListener("keydown", handlePrompterKey);
  window.addEventListener("mousemove", handlePrompterPointer);
  document.addEventListener("fullscreenchange", handleFullscreenChange);
});
onBeforeUnmount(() => {
  stopPlayback();
  window.removeEventListener("keydown", handlePrompterKey);
  window.removeEventListener("mousemove", handlePrompterPointer);
  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  if (noticeTimeout !== undefined) window.clearTimeout(noticeTimeout);
  if (controlsHideTimeout !== undefined) window.clearTimeout(controlsHideTimeout);
});

function showControlsForStartup() {
  controlsVisible.value = true;
  if (controlsHideTimeout !== undefined) window.clearTimeout(controlsHideTimeout);
  controlsHideTimeout = window.setTimeout(() => { controlsVisible.value = false; }, 2400);
}

function returnToEditor() {
  settingsOpen.value = false;
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
    manualSession.value = retreatManualRecording(manualSession.value, performance.now());
    project.value = { ...project.value, manualTimings: manualSession.value.timings };
    playback.seek(manualSession.value.cursor);
    return;
  }
  stopRecording();
  playback.previous();
}

function toggleRecording() {
  if (isRecording.value) {
    stopRecording(true);
    return;
  }
  if (!words.value.length) return;
  stopPlayback();
  manualSession.value = startManualRecording(createManualRecordingSession(words.value.length), performance.now());
  project.value = { ...project.value, timingMode: "manual", manualTimings: [] };
  playback.restart();
  showNotice("Grabando. Lee la palabra resaltada y pulsa → al terminar.");
}

function recordCurrentWord() {
  if (!isRecording.value) {
    stopRecording();
    return;
  }
  manualSession.value = advanceManualRecording(manualSession.value, performance.now());
  project.value = { ...project.value, manualTimings: manualSession.value.timings };
  playback.seek(manualSession.value.cursor);
  if (manualSession.value.status === "review") showNotice("Ritmo manual grabado. Puedes revisar, reproducir o volver a grabar.");
}

function stopRecording(captureCurrentWord = false) {
  if (!isRecording.value) return;
  manualSession.value = captureCurrentWord
    ? finishManualRecording(manualSession.value, performance.now())
    : { ...manualSession.value, status: "review", lastAdvanceAt: null };
  project.value = { ...project.value, manualTimings: manualSession.value.timings };
  playback.seek(manualSession.value.cursor);
  if (captureCurrentWord) showNotice("Grabación detenida. Puedes revisar, editar o reproducir el ritmo registrado.");
}

function togglePlayback() {
  if (isPlaying.value) {
    stopPlayback();
    return;
  }
  if (isRecording.value) stopRecording();
  if (!words.value.length) return;
  if (timingMode.value === "manual" && !project.value.manualTimings.length) {
    showNotice("Graba primero tu ritmo con el botón RECORD.");
    return;
  }
  playback.play();
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
  project.value.preferences.fontSize = Math.max(30, Math.min(96, project.value.preferences.fontSize + amount));
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await appRoot.value?.requestFullscreen();
  } catch {
    showNotice("El navegador no permitió cambiar a pantalla completa.");
  }
}
</script>

<template>
  <main
    ref="appRoot"
    class="app-shell"
    :class="[`screen-${screen}`, `theme-${project.preferences.theme}`, { 'controls-visible': controlsVisible }]"
    :style="{ '--prompter-font-size': `${project.preferences.fontSize}px` }"
  >
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
        v-model:theme="project.preferences.theme"
        v-model:language="project.automaticTiming.language"
        v-model:words-per-minute="project.preferences.wordsPerMinute"
        v-model:font-size="project.preferences.fontSize"
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
              @click="openProject"
            >
              Abrir proyecto
            </button>
            <button
              class="text-button"
              type="button"
              @click="saveProject"
            >
              Guardar
            </button>
          </div>
        </div>
        <div
          v-if="automaticLanguagePicker"
          class="language-choice"
        >
          <label>
            <span>Idioma para leer los números</span>
            <select v-model="project.automaticTiming.language">
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
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
        <span>Hecho para que tus ideas fluyan.</span><span>v0.1</span>
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
        v-model:theme="project.preferences.theme"
        v-model:language="project.automaticTiming.language"
        v-model:words-per-minute="project.preferences.wordsPerMinute"
        v-model:font-size="project.preferences.fontSize"
        @close="settingsOpen = false"
      />
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
            :disabled="isRecording"
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
            :disabled="!words.length"
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
  </main>
</template>
