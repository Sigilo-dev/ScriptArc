import { computed, onBeforeUnmount, ref, watch, type ComputedRef } from "vue";
import type { ReadingWord } from "../../shared/types";
import { calculatePlaybackElapsed } from "./playbackState";

export function usePlayback(
  words: ComputedRef<ReadingWord[]>,
  durationForWord: (word: ReadingWord) => number,
) {
  const cursor = ref(0);
  const isPlaying = ref(false);
  const clockNow = ref(0);
  let playbackTimer: number | undefined;
  let clockTimer: number | undefined;
  let currentSegmentDuration = 0;
  let currentRemainingMilliseconds = 0;
  let elapsedInCurrentWord = 0;
  let segmentStartedAt = 0;

  const durations = computed(() => words.value.map((word) => Math.max(1, durationForWord(word))));
  const totalDurationMilliseconds = computed(() => durations.value.reduce((total, duration) => total + duration, 0));
  const elapsedMilliseconds = computed(() => {
    const inWord = isPlaying.value
      ? elapsedInCurrentWord + Math.min(currentSegmentDuration, Math.max(0, clockNow.value - segmentStartedAt))
      : elapsedInCurrentWord;
    return calculatePlaybackElapsed(durations.value, cursor.value, inWord);
  });
  const remainingMilliseconds = computed(() => Math.max(0, totalDurationMilliseconds.value - elapsedMilliseconds.value));
  const progressPercent = computed(() => totalDurationMilliseconds.value
    ? Math.min(100, elapsedMilliseconds.value / totalDurationMilliseconds.value * 100)
    : 0);

  function durationAt(index: number): number {
    return durations.value[index] ?? 1;
  }

  function clearTimers() {
    if (playbackTimer !== undefined) window.clearTimeout(playbackTimer);
    if (clockTimer !== undefined) window.clearInterval(clockTimer);
    playbackTimer = undefined;
    clockTimer = undefined;
  }

  function pause() {
    if (isPlaying.value) {
      const elapsedInSegment = Math.min(currentSegmentDuration, Math.max(0, performance.now() - segmentStartedAt));
      elapsedInCurrentWord += elapsedInSegment;
      currentRemainingMilliseconds = Math.max(0, currentSegmentDuration - elapsedInSegment);
    }
    isPlaying.value = false;
    clockNow.value = performance.now();
    clearTimers();
  }

  function scheduleCurrentSegment() {
    currentSegmentDuration = Math.max(1, currentRemainingMilliseconds || durationAt(cursor.value));
    currentRemainingMilliseconds = currentSegmentDuration;
    segmentStartedAt = performance.now();
    clockNow.value = segmentStartedAt;
    playbackTimer = window.setTimeout(advanceFromTimer, currentSegmentDuration);
  }

  function finishPlayback() {
    isPlaying.value = false;
    currentSegmentDuration = 0;
    currentRemainingMilliseconds = 0;
    elapsedInCurrentWord = 0;
    clockNow.value = performance.now();
    clearTimers();
  }

  function advanceFromTimer() {
    if (!isPlaying.value) return;
    cursor.value += 1;
    if (cursor.value >= words.value.length) {
      cursor.value = words.value.length;
      elapsedInCurrentWord = 0;
      finishPlayback();
      return;
    }
    elapsedInCurrentWord = 0;
    currentRemainingMilliseconds = durationAt(cursor.value);
    scheduleCurrentSegment();
  }

  function play() {
    if (isPlaying.value || words.value.length === 0) return;
    if (cursor.value >= words.value.length) {
      cursor.value = 0;
      currentRemainingMilliseconds = 0;
    }
    if (currentRemainingMilliseconds === 0) currentRemainingMilliseconds = durationAt(cursor.value);
    isPlaying.value = true;
    clockTimer = window.setInterval(() => { clockNow.value = performance.now(); }, 100);
    scheduleCurrentSegment();
  }

  function restart() {
    pause();
    cursor.value = 0;
    currentSegmentDuration = 0;
    currentRemainingMilliseconds = 0;
    elapsedInCurrentWord = 0;
    clockNow.value = performance.now();
  }

  function next() {
    pause();
    cursor.value = Math.min(words.value.length, cursor.value + 1);
    currentSegmentDuration = 0;
    currentRemainingMilliseconds = 0;
    elapsedInCurrentWord = 0;
  }

  function previous() {
    pause();
    cursor.value = Math.max(0, cursor.value - 1);
    currentSegmentDuration = 0;
    currentRemainingMilliseconds = 0;
    elapsedInCurrentWord = 0;
  }

  function seek(index: number) {
    pause();
    cursor.value = Math.max(0, Math.min(words.value.length, Math.round(index)));
    currentSegmentDuration = 0;
    currentRemainingMilliseconds = 0;
    elapsedInCurrentWord = 0;
  }

  function toggle() {
    if (isPlaying.value) pause();
    else play();
  }

  watch(() => words.value.length, (count) => {
    if (cursor.value > count) seek(count);
  });
  onBeforeUnmount(pause);

  return {
    cursor,
    isPlaying,
    elapsedMilliseconds,
    remainingMilliseconds,
    totalDurationMilliseconds,
    progressPercent,
    play,
    pause,
    toggle,
    restart,
    next,
    previous,
    seek,
  };
}
