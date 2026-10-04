<script setup lang="ts">
import { nextTick, ref } from "vue";
import { translate, type UiTextKey } from "../../shared/localization";
import type { Language } from "../../shared/types";

const props = defineProps<{ modelValue: string; interfaceLanguage: Language }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const t = (key: UiTextKey) => translate(props.interfaceLanguage, key);

const textarea = ref<HTMLTextAreaElement | null>(null);

function wrapSelection(before: string, after: string) {
  const field = textarea.value;
  if (!field) return;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const selection = field.value.slice(start, end) || (props.interfaceLanguage === "es" ? "texto" : "text");
  field.setRangeText(`${before}${selection}${after}`, start, end, "select");
  emit("update:modelValue", field.value);
  nextTick(() => {
    field.focus();
    field.setSelectionRange(start + before.length, start + before.length + selection.length);
  });
}

function addHeading() {
  const field = textarea.value;
  if (!field) return;
  const start = field.selectionStart;
  const lineStart = field.value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineEndIndex = field.value.indexOf("\n", start);
  const lineEnd = lineEndIndex === -1 ? field.value.length : lineEndIndex;
  const currentLine = field.value.slice(lineStart, lineEnd);
  const markerLength = /^(?:#{1,6}\s*)/u.exec(currentLine)?.[0].length ?? 0;
  field.setRangeText("## ", lineStart, lineStart + markerLength, "end");
  emit("update:modelValue", field.value);
  nextTick(() => {
    field.focus();
    const caret = lineStart + 3;
    field.setSelectionRange(caret, caret);
  });
}

function updateText(event: Event) {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <div class="markdown-editor">
    <div
      class="markdown-toolbar"
      role="toolbar"
      :aria-label="t('markdownToolbar')"
    >
      <button
        type="button"
        class="format-button"
        :aria-label="t('insertHeading')"
        :title="t('heading')"
        @mousedown.prevent
        @click="addHeading"
      >
        H
      </button>
      <span
        class="toolbar-divider"
        aria-hidden="true"
      />
      <button
        type="button"
        class="format-button format-strong"
        :aria-label="t('insertBold')"
        :title="t('bold')"
        @mousedown.prevent
        @click="wrapSelection('**', '**')"
      >
        B
      </button>
      <button
        type="button"
        class="format-button format-italic"
        :aria-label="t('insertItalic')"
        :title="t('italic')"
        @mousedown.prevent
        @click="wrapSelection('*', '*')"
      >
        I
      </button>
      <button
        type="button"
        class="format-button format-strike"
        :aria-label="t('insertStrike')"
        :title="t('strikethrough')"
        @mousedown.prevent
        @click="wrapSelection('~~', '~~')"
      >
        S
      </button>
      <span class="toolbar-note">Markdown</span>
    </div>
    <label
      class="sr-only"
      for="script-source"
    >{{ t('markdownText') }}</label>
    <textarea
      id="script-source"
      ref="textarea"
      class="script-input"
      :value="modelValue"
      :placeholder="t('scriptPlaceholder')"
      spellcheck="true"
      @input="updateText"
    />
  </div>
</template>
