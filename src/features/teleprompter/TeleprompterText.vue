<script setup lang="ts">
import { nextTick, onMounted, watch } from "vue";
import type { MarkdownBlock, ReadingWord } from "../../shared/types";

const props = defineProps<{
  blocks: MarkdownBlock[];
  words: ReadingWord[];
  cursor: number;
}>();

const wordElements = new Map<number, HTMLElement>();
let lastAppliedCursor = -1;

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

function syncCursor(resetAll = false) {
  const start = resetAll || lastAppliedCursor < 0 ? 0 : Math.min(lastAppliedCursor, props.cursor);
  const end = resetAll || lastAppliedCursor < 0
    ? props.words.length - 1
    : Math.max(lastAppliedCursor, props.cursor);
  for (let index = start; index <= end; index += 1) {
    const element = wordElements.get(index);
    if (!element) continue;
    element.classList.toggle("word-current", index === props.cursor);
    element.classList.toggle("word-spoken", index < props.cursor);
    if (index === props.cursor) element.setAttribute("aria-current", "step");
    else element.removeAttribute("aria-current");
  }
  lastAppliedCursor = props.cursor;
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  void nextTick(() => wordElements.get(props.cursor)?.scrollIntoView({ behavior, block: "center" }));
}

watch(() => props.cursor, () => syncCursor(), { flush: "post" });
watch(() => props.words, () => {
  void nextTick(() => syncCursor(true));
}, { flush: "post" });
onMounted(() => syncCursor(true));
</script>

<template>
  <section
    class="prompter-view"
    aria-label="Teleprompter"
  >
    <div
      v-if="words.length"
      v-memo="[words]"
      class="prompter-text"
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
            :class="words[wordIndex].emphasisStyles.map((style) => `word-${style}`)"
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
