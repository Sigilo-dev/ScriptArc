<script setup lang="ts">
import { computed, ref } from "vue";

type Screen = "editor" | "teleprompter";
type TimingMode = "automatic" | "manual";

const screen = ref<Screen>("editor");
const timingMode = ref<TimingMode>("automatic");
const sourceMarkdown = ref("");
const cursor = ref(0);
const words = computed(() => sourceMarkdown.value.trim().split(/\s+/).filter(Boolean));

function start(mode: TimingMode) {
  timingMode.value = mode;
  cursor.value = 0;
  screen.value = "teleprompter";
}

function returnToEditor() {
  screen.value = "editor";
}

function advance() {
  cursor.value = Math.min(cursor.value + 1, Math.max(0, words.value.length - 1));
}

function retreat() {
  cursor.value = Math.max(0, cursor.value - 1);
}
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
        </div>

        <label
          class="sr-only"
          for="script-source"
        >Texto en Markdown</label>
        <textarea
          id="script-source"
          v-model="sourceMarkdown"
          class="script-input"
          placeholder="Coloca tu texto aquí..."
          spellcheck="true"
        />

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
              disabled
            >
              Abrir proyecto
            </button>
            <button
              class="text-button"
              type="button"
              disabled
            >
              Guardar
            </button>
          </div>
        </div>
        <p class="editor-hint">
          Pega o escribe tu texto; tus palabras siempre se quedan contigo.
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
        <span class="mode-label">{{ timingMode === "automatic" ? "Modo automático" : "Modo manual" }}</span>
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
            :key="`${index}-${word}`"
            :class="{ 'word-current': index === cursor, 'word-spoken': index < cursor }"
          >{{ word }} </span>
        </div>
        <p
          v-if="!words.length"
          class="empty-prompter"
        >
          Vuelve al editor y coloca tu texto.
        </p>
      </section>
      <footer class="prompter-controls">
        <button
          class="button button-secondary"
          type="button"
          aria-label="Retroceder palabra"
          @click="retreat"
        >
          ←
        </button>
        <span class="progress-label">{{ words.length ? `${cursor + 1} / ${words.length}` : "Sin texto" }}</span>
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
