<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isTauri } from "@tauri-apps/api/core";
import ScriptEditor from "./features/editor/ScriptEditor.vue";
import { parseMarkdown } from "./features/markdown/parseMarkdown";
import { createProject, updateProjectMarkdown } from "./features/project/projectModel";
import { loadLocalProject, openProjectFile, saveLocalProject, saveProjectFile } from "./features/project/projectPersistence";
import { createAutomaticReadingWords } from "./features/teleprompter/automaticTiming";
import { manualWordDuration, upsertManualWordTiming } from "./features/teleprompter/manualTiming";
import type { ReadingWord, TimingMode } from "./shared/types";

type Screen = "editor" | "teleprompter";

const screen = ref<Screen>("editor");
const project = ref(loadLocalProject() ?? createProject());
const sourceMarkdown = computed({
  get: () => project.value.sourceMarkdown,
  set: (markdown: string) => { project.value = updateProjectMarkdown(project.value, markdown); },
});
const timingMode = computed(() => project.value.timingMode);
const cursor = ref(0);
const isRecording = ref(false);
const document = computed(() => parseMarkdown(sourceMarkdown.value));
const words = computed<ReadingWord[]>(() => timingMode.value === "automatic"
  ? createAutomaticReadingWords(document.value, project.value.automaticTiming)
  : document.value.tokens.map((token) => ({ ...token, sourceTokenIndex: token.index, durationMilliseconds: 0, isNumberExpansion: false })));
const isPlaying = ref(false);
const filePath = ref<string | null>(null);
const notice = ref("");
const wordElements = new Map<number, HTMLElement>();
let noticeTimeout: number | undefined;
let playbackTimer: number | undefined;
let lastManualTimestamp = 0;

watch(project, (value) => {
  try {
    saveLocalProject(value);
  } catch {
    showNotice("No se pudo guardar el borrador local.");
  }
}, { deep: true });

function start(mode: TimingMode) {
  stopRecording();
  stopPlayback();
  project.value = { ...project.value, timingMode: mode };
  cursor.value = 0;
  screen.value = "teleprompter";
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
    filePath.value = opened.filePath;
    cursor.value = 0;
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
  if (event.key === "ArrowRight") {
    event.preventDefault();
    advance();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    retreat();
  } else if (event.key === "Escape") {
    returnToEditor();
  }
}

onMounted(() => window.addEventListener("keydown", handlePrompterKey));
onBeforeUnmount(() => {
  stopPlayback();
  window.removeEventListener("keydown", handlePrompterKey);
  if (noticeTimeout !== undefined) window.clearTimeout(noticeTimeout);
});

function returnToEditor() {
  stopRecording();
  stopPlayback();
  screen.value = "editor";
}

function advance() {
  if (timingMode.value === "manual" && isRecording.value) {
    recordCurrentWord();
    return;
  }
  stopPlayback();
  cursor.value = Math.min(cursor.value + 1, words.value.length);
}

function retreat() {
  stopRecording();
  stopPlayback();
  cursor.value = Math.max(0, cursor.value - 1);
}

function toggleRecording() {
  if (isRecording.value) {
    stopRecording();
    return;
  }
  if (!words.value.length) return;
  stopPlayback();
  if (cursor.value >= words.value.length) cursor.value = 0;
  const retainedTimings = project.value.manualTimings.filter((timing) => timing.tokenIndex < cursor.value);
  project.value = { ...project.value, timingMode: "manual", manualTimings: retainedTimings };
  lastManualTimestamp = performance.now();
  isRecording.value = true;
  showNotice("Grabando. Lee la palabra resaltada y pulsa → al terminar.");
}

function recordCurrentWord() {
  const word = words.value[cursor.value];
  if (!word || !isRecording.value) {
    stopRecording();
    return;
  }
  const now = performance.now();
  const updatedTimings = upsertManualWordTiming(project.value.manualTimings, word.sourceTokenIndex, now - lastManualTimestamp);
  project.value = {
    ...project.value,
    manualTimings: updatedTimings,
  };
  cursor.value += 1;
  lastManualTimestamp = now;
  if (cursor.value >= words.value.length) {
    stopRecording();
    showNotice("Ritmo manual grabado. Puedes reproducirlo o volver a grabar.");
  }
}

function stopRecording() {
  isRecording.value = false;
}

function togglePlayback() {
  if (isPlaying.value) {
    stopPlayback();
    return;
  }
  if (isRecording.value) stopRecording();
  if (!words.value.length) return;
  if (timingMode.value === "manual" && !project.value.manualTimings.length) {
    showNotice("Graba primero tu ritmo con el botón Grabar.");
    return;
  }
  if (cursor.value >= words.value.length) cursor.value = 0;
  isPlaying.value = true;
  scheduleNextWord();
}

function scheduleNextWord() {
  const word = words.value[cursor.value];
  if (!word || !isPlaying.value) {
    stopPlayback();
    return;
  }
  playbackTimer = window.setTimeout(() => {
    if (cursor.value >= words.value.length - 1) {
      cursor.value = words.value.length;
      stopPlayback();
      return;
    }
    cursor.value += 1;
    scheduleNextWord();
  }, playbackDuration(word));
}

function playbackDuration(word: ReadingWord): number {
  if (timingMode.value === "automatic") return word.durationMilliseconds;
  const fallback = Math.max(250, word.visibleText.length * project.value.automaticTiming.baseMillisecondsPerCharacter);
  return manualWordDuration(project.value.manualTimings, word.sourceTokenIndex, fallback);
}

function stopPlayback() {
  isPlaying.value = false;
  if (playbackTimer !== undefined) window.clearTimeout(playbackTimer);
  playbackTimer = undefined;
}

function setWordElement(element: unknown, index: number) {
  if (element instanceof HTMLElement) wordElements.set(index, element);
  else wordElements.delete(index);
}

watch([screen, cursor], () => {
  if (screen.value !== "teleprompter") return;
  void nextTick(() => wordElements.get(cursor.value)?.scrollIntoView({ behavior: "smooth", block: "center" }));
}, { flush: "post" });
</script>

<template>
  <main
    class="app-shell"
    :class="`screen-${screen}`"
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
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </header>

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
              @click="start('automatic')"
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
      <header class="prompter-toolbar">
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
        >
          ⚙
        </button>
      </header>
      <section
        class="prompter-view"
        aria-label="Teleprompter"
      >
        <div
          class="prompter-text"
          aria-live="polite"
        >
          <span
            v-for="(word, index) in words"
            :key="`${index}-${word.visibleText}`"
            :ref="(element) => setWordElement(element, index)"
            :class="[
              { 'word-current': index === cursor, 'word-spoken': index < cursor },
              word.emphasis ? `word-${word.emphasis}` : '',
            ]"
          >{{ word.visibleText }} </span>
        </div>
        <p
          v-if="!words.length"
          class="empty-prompter"
        >
          Vuelve al editor y coloca tu texto.
        </p>
      </section>
      <p
        v-if="timingMode === 'manual'"
        class="manual-instruction"
      >
        {{ isRecording ? "Lee la palabra blanca y pulsa → cuando termines; cada toque registra su duración." : "Pulsa Grabar, lee la palabra blanca y avanza con → al terminar cada palabra." }}
      </p>
      <p
        class="notice notice-dark"
        role="status"
        aria-live="polite"
      >
        {{ notice }}
      </p>
      <footer class="prompter-controls">
        <button
          class="button button-secondary"
          type="button"
          aria-label="Retroceder palabra"
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
          {{ isRecording ? "Detener" : "Grabar" }}
        </button>
        <button
          class="button button-secondary playback-button"
          type="button"
          :disabled="!words.length || (timingMode === 'manual' && (!project.manualTimings.length || isRecording))"
          @click="togglePlayback"
        >
          {{ isPlaying ? "Pausar" : "Reproducir" }}
        </button>
        <span class="progress-label">{{ words.length ? `${Math.min(cursor + 1, words.length)} / ${words.length}` : "Sin texto" }}</span>
        <button
          class="button button-primary"
          type="button"
          aria-label="Avanzar palabra"
          @click="advance"
        >
          →
        </button>
      </footer>
    </template>
  </main>
</template>
