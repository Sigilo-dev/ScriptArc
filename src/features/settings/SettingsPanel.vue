<script setup lang="ts">
import type { Language, ThemeId } from "../../shared/types";
import { AUTOMATIC_TIMING_LIMITS } from "../teleprompter/automaticTiming";
import { translate, type UiTextKey } from "../../shared/localization";
import { THEME_OPTIONS } from "./themes";

const props = defineProps<{
  interfaceLanguage: Language;
  theme: ThemeId;
  language: Language;
  wordsPerMinute: number;
  fontSize: number;
  countdownSeconds: number;
  hideControlsAutomatically: boolean;
}>();

const emit = defineEmits<{
  close: [];
  "update:interfaceLanguage": [value: Language];
  "update:theme": [value: ThemeId];
  "update:language": [value: Language];
  "update:wordsPerMinute": [value: number];
  "update:fontSize": [value: number];
  "update:countdownSeconds": [value: number];
  "update:hideControlsAutomatically": [value: boolean];
}>();

const t = (key: UiTextKey) => translate(props.interfaceLanguage, key);
const themeLabelKeys: Record<ThemeId, UiTextKey> = {
  white: "themeWhite",
  gray: "themeGray",
  orange: "themeOrange",
  blue: "themeBlue",
  pink: "themePink",
  black: "themeBlack",
};
</script>

<template>
  <section
    class="settings-panel"
    :aria-label="t('settingsPanel')"
  >
    <div class="settings-heading">
      <div>
        <p class="settings-eyebrow">
          {{ t('preferences') }}
        </p>
        <h2>{{ t('customizeReading') }}</h2>
      </div>
      <button
        type="button"
        class="settings-close"
        :aria-label="t('closeSettings')"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <div
      class="settings-theme-picker"
      role="group"
      :aria-label="t('theme')"
    >
      <span class="settings-label">{{ t('theme') }}</span>
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
          <span>{{ t(themeLabelKeys[option.id]) }}</span>
        </button>
      </div>
    </div>

    <label class="settings-field">
      <span>{{ t('interfaceLanguage') }}</span>
      <select
        :value="interfaceLanguage"
        @change="emit('update:interfaceLanguage', ($event.target as HTMLSelectElement).value as Language)"
      >
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
    </label>

    <label class="settings-field">
      <span>{{ t('speakingLanguage') }}</span>
      <select
        :value="language"
        @change="emit('update:language', ($event.target as HTMLSelectElement).value as Language)"
      >
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
    </label>

    <label class="settings-range">
      <span><span>{{ t('automaticPace') }}</span><output>{{ wordsPerMinute }} {{ t('wordsPerMinute') }}</output></span>
      <input
        type="range"
        :min="AUTOMATIC_TIMING_LIMITS.minimumWordsPerMinute"
        :max="AUTOMATIC_TIMING_LIMITS.maximumWordsPerMinute"
        step="5"
        :value="wordsPerMinute"
        @input="emit('update:wordsPerMinute', Number(($event.target as HTMLInputElement).value))"
      >
    </label>

    <label class="settings-field">
      <span>{{ t('countdown') }}</span>
      <select
        :value="countdownSeconds"
        @change="emit('update:countdownSeconds', Number(($event.target as HTMLSelectElement).value))"
      >
        <option :value="0">{{ t('noCountdown') }}</option>
        <option :value="3">3 {{ t('seconds') }}</option>
        <option :value="5">5 {{ t('seconds') }}</option>
        <option :value="10">10 {{ t('seconds') }}</option>
      </select>
    </label>

    <label class="settings-toggle">
      <input
        type="checkbox"
        :checked="hideControlsAutomatically"
        @change="emit('update:hideControlsAutomatically', ($event.target as HTMLInputElement).checked)"
      >
      <span>{{ t('hideControls') }}</span>
    </label>

    <label class="settings-range">
      <span><span>{{ t('defaultFontSize') }}</span><output>{{ fontSize }} {{ t('pixels') }}</output></span>
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
