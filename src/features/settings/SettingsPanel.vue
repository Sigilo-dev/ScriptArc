<script setup lang="ts">
import type { Language, ThemeId } from "../../shared/types";
import { AUTOMATIC_TIMING_LIMITS } from "../teleprompter/automaticTiming";
import { THEME_OPTIONS } from "./themes";

defineProps<{
  theme: ThemeId;
  language: Language;
  wordsPerMinute: number;
  fontSize: number;
}>();

const emit = defineEmits<{
  close: [];
  "update:theme": [value: ThemeId];
  "update:language": [value: Language];
  "update:wordsPerMinute": [value: number];
  "update:fontSize": [value: number];
}>();
</script>

<template>
  <section
    class="settings-panel"
    aria-label="Preferencias de lectura"
  >
    <div class="settings-heading">
      <div>
        <p class="settings-eyebrow">
          Preferencias
        </p>
        <h2>Personaliza tu lectura</h2>
      </div>
      <button
        type="button"
        class="settings-close"
        aria-label="Cerrar configuración"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <div
      class="settings-theme-picker"
      role="group"
      aria-label="Tema"
    >
      <span class="settings-label">Tema</span>
      <div class="theme-options">
        <button
          v-for="option in THEME_OPTIONS"
          :key="option.id"
          class="theme-option"
          type="button"
          :aria-pressed="theme === option.id"
          @click="emit('update:theme', option.id)"
        >
          <span
            class="theme-swatch"
            :style="{ backgroundColor: option.color }"
          />
          <span>{{ option.label }}</span>
        </button>
      </div>
    </div>

    <label class="settings-field">
      <span>Idioma automático</span>
      <select
        :value="language"
        @change="emit('update:language', ($event.target as HTMLSelectElement).value as Language)"
      >
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
    </label>

    <label class="settings-range">
      <span><span>Ritmo de lectura</span><output>{{ wordsPerMinute }} palabras/min</output></span>
      <input
        type="range"
        :min="AUTOMATIC_TIMING_LIMITS.minimumWordsPerMinute"
        :max="AUTOMATIC_TIMING_LIMITS.maximumWordsPerMinute"
        step="5"
        :value="wordsPerMinute"
        @input="emit('update:wordsPerMinute', Number(($event.target as HTMLInputElement).value))"
      >
    </label>

    <label class="settings-range">
      <span><span>Tamaño de letra</span><output>{{ fontSize }} px</output></span>
      <input
        type="range"
        min="30"
        max="96"
        step="2"
        :value="fontSize"
        @input="emit('update:fontSize', Number(($event.target as HTMLInputElement).value))"
      >
    </label>
  </section>
</template>
