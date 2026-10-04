<script setup lang="ts">
import { computed, ref } from "vue";
import type { CustomTheme, Language, PresetThemeId, ThemeId, ThemePalette } from "../../shared/types";
import { AUTOMATIC_TIMING_LIMITS } from "../teleprompter/automaticTiming";
import { translate, type UiTextKey } from "../../shared/localization";
import { THEME_OPTIONS } from "./themes";

const props = defineProps<{
  interfaceLanguage: Language;
  theme: ThemeId;
  customThemes: CustomTheme[];
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
  "create:customTheme": [value: { name: string; baseTheme: PresetThemeId }];
  "update:customTheme": [value: CustomTheme];
  "delete:customTheme": [id: string];
  "update:language": [value: Language];
  "update:wordsPerMinute": [value: number];
  "update:fontSize": [value: number];
  "update:countdownSeconds": [value: number];
  "update:hideControlsAutomatically": [value: boolean];
}>();

const t = (key: UiTextKey, values: Record<string, string | number> = {}) => translate(props.interfaceLanguage, key, values);
const customThemeCreationOpen = ref(false);
const customThemeName = ref("");
const customThemeBase = ref<PresetThemeId>("white");
const selectedCustomTheme = computed(() => {
  if (!props.theme.startsWith("custom:")) return undefined;
  const id = props.theme.slice("custom:".length);
  return props.customThemes.find((theme) => theme.id === id);
});
const paletteFields: { key: keyof ThemePalette; label: UiTextKey }[] = [
  { key: "surface", label: "colorSurface" },
  { key: "surfaceMuted", label: "colorSurfaceMuted" },
  { key: "text", label: "colorText" },
  { key: "textSoft", label: "colorTextSoft" },
  { key: "line", label: "colorLine" },
  { key: "accent", label: "colorAccent" },
  { key: "accentSoft", label: "colorAccentSoft" },
  { key: "prompterBg", label: "colorPrompterBg" },
  { key: "prompterMuted", label: "colorPrompterMuted" },
  { key: "prompterTextColor", label: "colorPrompterText" },
  { key: "prompterCurrentColor", label: "colorPrompterCurrent" },
  { key: "prompterSpokenColor", label: "colorPrompterSpoken" },
];
const themeLabelKeys: Record<PresetThemeId, UiTextKey> = {
  white: "themeWhite", gray: "themeGray", orange: "themeOrange", blue: "themeBlue", pink: "themePink", black: "themeBlack",
};

function addCustomTheme() {
  const name = customThemeName.value.trim();
  if (!name) return;
  emit("create:customTheme", { name, baseTheme: customThemeBase.value });
  customThemeName.value = "";
  customThemeCreationOpen.value = false;
}

function updatePaletteColor(key: keyof ThemePalette, event: Event) {
  if (!selectedCustomTheme.value) return;
  const color = (event.target as HTMLInputElement).value;
  emit("update:customTheme", {
    ...selectedCustomTheme.value,
    palette: { ...selectedCustomTheme.value.palette, [key]: color },
  });
}
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
      <div class="custom-theme-heading">
        <span class="settings-label">{{ t('customThemes') }}</span>
        <button
          class="theme-add-button"
          type="button"
          :aria-label="t('addCustomTheme')"
          :title="t('addCustomTheme')"
          @click="customThemeCreationOpen = !customThemeCreationOpen"
        >
          +
        </button>
      </div>
      <form
        v-if="customThemeCreationOpen"
        class="custom-theme-create"
        @submit.prevent="addCustomTheme"
      >
        <input
          v-model="customThemeName"
          type="text"
          maxlength="60"
          :placeholder="t('customThemeNamePlaceholder')"
          :aria-label="t('customThemeName')"
          required
        >
        <label>
          <span>{{ t('customThemeBase') }}</span>
          <select v-model="customThemeBase">
            <option
              v-for="option in THEME_OPTIONS"
              :key="option.id"
              :value="option.id"
            >
              {{ t(themeLabelKeys[option.id]) }}
            </option>
          </select>
        </label>
        <button
          class="button button-primary"
          type="submit"
        >
          {{ t('createTheme') }}
        </button>
      </form>
      <div
        v-if="customThemes.length"
        class="custom-theme-options"
      >
        <div
          v-for="customTheme in customThemes"
          :key="customTheme.id"
          class="custom-theme-item"
        >
          <button
            class="theme-option custom-theme-option"
            type="button"
            :aria-pressed="theme === `custom:${customTheme.id}`"
            @click="emit('update:theme', `custom:${customTheme.id}`)"
          >
            <span
              class="theme-swatch"
              :style="{ backgroundColor: customTheme.palette.accent }"
            />
            <span>{{ customTheme.name }}</span>
          </button>
          <button
            class="custom-theme-delete"
            type="button"
            :aria-label="t('deleteCustomTheme', { name: customTheme.name })"
            :title="t('deleteTheme')"
            @click="emit('delete:customTheme', customTheme.id)"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <section
      v-if="selectedCustomTheme"
      class="custom-palette-editor"
      :aria-label="t('customizeColors')"
    >
      <h3>{{ t('customizeColors') }} · {{ selectedCustomTheme.name }}</h3>
      <label
        v-for="field in paletteFields"
        :key="field.key"
        class="custom-color-field"
      >
        <span>{{ t(field.label) }}</span>
        <input
          type="color"
          :value="selectedCustomTheme.palette[field.key]"
          :aria-label="t(field.label)"
          @input="updatePaletteColor(field.key, $event)"
        >
      </label>
    </section>

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
      <span>{{ t('recordingCountdown') }}</span>
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
