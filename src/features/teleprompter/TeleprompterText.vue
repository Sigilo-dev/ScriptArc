<script setup lang="ts">
import { nextTick, watch } from "vue";
import type { MarkdownBlock, ReadingWord } from "../../shared/types";

const props = defineProps<{
  blocks: MarkdownBlock[];
  words: ReadingWord[];
  cursor: number;
}>();

const wordElements = new Map<number, HTMLElement>();

function indexes(block: MarkdownBlock): number[] {
  return Array.from({ length: Math.max(0, block.tokenEnd - block.tokenStart) }, (_, offset) => block.tokenStart + offset);
}

function blockTag(block: MarkdownBlock): string {
  if (block.kind === "heading") return `h${Math.max(1, Math.min(6, block.level ?? 1))}`;
  return block.kind === "quote" ? "blockquote" : "p";
}

function setWordElement(element: unknown, index: number) {
  if (element instanceof HTMLElement) wordElements.set(index, element);
  else wordElements.delete(index);
}

watch(() => [props.cursor, props.words.length], () => {
  void nextTick(() => wordElements.get(props.cursor)?.scrollIntoView({ behavior: "smooth", block: "center" }));
}, { flush: "post" });
</script>

<template>
  <section
    class="prompter-view"
    aria-label="Teleprompter"
  >
    <div
      v-if="words.length"
      class="prompter-text"
      aria-live="polite"
    >
      <component
        :is="blockTag(block)"
        v-for="(block, blockIndex) in blocks"
        :key="`${block.kind}-${blockIndex}-${block.tokenStart}`"
        class="prompter-block"
        :class="[`block-${block.kind}`, block.kind === 'heading' ? `block-heading-${block.level}` : '']"
      >
        <template
          v-for="wordIndex in indexes(block)"
          :key="`${wordIndex}-${words[wordIndex]?.displayText}`"
        >
          <span
            v-if="words[wordIndex]"
            :ref="(element) => setWordElement(element, wordIndex)"
            :class="[
              { 'word-current': wordIndex === cursor, 'word-spoken': wordIndex < cursor },
              ...words[wordIndex].emphasisStyles.map((style) => `word-${style}`),
            ]"
          >{{ words[wordIndex].displayText }}</span>{{ wordIndex < block.tokenEnd - 1 ? ' ' : '' }}
        </template>
      </component>
    </div>
    <p
      v-else
      class="empty-prompter"
    >
      Vuelve al editor y coloca tu texto.
    </p>
  </section>
</template>
