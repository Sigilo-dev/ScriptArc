import { computed, onBeforeUnmount, ref, watch, type ComputedRef } from "vue";
import type { ReadingWord } from "../../shared/types";
import { advancePlaybackDeadline } from "./playbackState";

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
  let segmentDeadline = 0;

  const durations = computed(() => words.value.map((word) => Math.max(1, durationForWord(word))));
  const cumulativeDurations = computed(() => {
    const cumulative = [0];
    for (const duration of durations.value) cumulative.push((cumulative[cumulative.length - 1] ?? 0) + duration);
    return cumulative;
  });
  const totalDurationMilliseconds = computed(() => cumulativeDurations.value[cumulativeDurations.value.length - 1] ?? 0);
  const elapsedMilliseconds = computed(() => {
    const inWord = isPlaying.value
      ? elapsedInCurrentWord + Math.min(currentSegmentDuration, Math.max(0, clockNow.value - segmentStartedAt))
      : elapsedInCurrentWord;
    const completed = cumulativeDurations.value[Math.min(cursor.value, words.value.length)] ?? totalDurationMilliseconds.value;
    const currentDuration = durationAt(cursor.value);
    return completed + Math.max(0, Math.min(currentDuration, inWord));
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
      const now = performance.now();
      if (now >= segmentDeadline) {
        const next = advancePlaybackDeadline(cursor.value, durations.value, segmentDeadline, now);
        cursor.value = next.cursor;
        if (next.finished) {
          finishPlayback();
          return;
        }
        elapsedInCurrentWord = next.elapsedInCurrentWord;
        currentSegmentDuration = durationAt(cursor.value);
        currentRemainingMilliseconds = Math.max(0, next.deadline - now);
        segmentDeadline = next.deadline;
        segmentStartedAt = now;
      } else {
        const elapsedInSegment = Math.min(
          Math.max(0, currentSegmentDuration - elapsedInCurrentWord),
          Math.max(0, now - segmentStartedAt),
        );
        elapsedInCurrentWord += elapsedInSegment;
        currentRemainingMilliseconds = Math.max(0, segmentDeadline - now);
      }
    }
    isPlaying.value = false;
    clockNow.value = performance.now();
    clearTimers();
  }

  function scheduleCurrentSegment() {
    const now = performance.now();
    if (currentSegmentDuration <= 0) currentSegmentDuration = durationAt(cursor.value);
    if (currentRemainingMilliseconds <= 0) currentRemainingMilliseconds = Math.max(1, currentSegmentDuration - elapsedInCurrentWord);
    segmentStartedAt = now;
    segmentDeadline = now + currentRemainingMilliseconds;
    clockNow.value = now;
    playbackTimer = window.setTimeout(advanceFromTimer, currentRemainingMilliseconds);
  }

  function finishPlayback() {
    isPlaying.value = false;
    currentSegmentDuration = 0;
    currentRemainingMilliseconds = 0;
    elapsedInCurrentWord = 0;
    segmentDeadline = 0;
    clockNow.value = performance.now();
    clearTimers();
  }

  function advanceFromTimer() {
    if (!isPlaying.value) return;
    const now = performance.now();
    const next = advancePlaybackDeadline(cursor.value, durations.value, segmentDeadline, now);
    cursor.value = next.cursor;
    if (next.finished) {
      finishPlayback();
      return;
    }
    elapsedInCurrentWord = next.elapsedInCurrentWord;
    currentSegmentDuration = durationAt(cursor.value);
    currentRemainingMilliseconds = Math.max(0, next.deadline - now);
    segmentDeadline = next.deadline;
    segmentStartedAt = now;
    clockNow.value = now;
    if (clockTimer === undefined) clockTimer = window.setInterval(() => { clockNow.value = performance.now(); }, 100);
    playbackTimer = window.setTimeout(advanceFromTimer, currentRemainingMilliseconds);
  }

  function play() {
    if (isPlaying.value || words.value.length === 0) return;
    if (cursor.value >= words.value.length) {
      cursor.value = 0;
      currentRemainingMilliseconds = 0;
    }
    if (currentSegmentDuration === 0) currentSegmentDuration = durationAt(cursor.value);
    if (currentRemainingMilliseconds === 0) currentRemainingMilliseconds = Math.max(1, currentSegmentDuration - elapsedInCurrentWord);
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
    segmentDeadline = 0;
    clockNow.value = performance.now();
  }

  function next() {
    pause();
    cursor.value = Math.min(words.value.length, cursor.value + 1);
    currentSegmentDuration = 0;
    currentRemainingMilliseconds = 0;
    elapsedInCurrentWord = 0;
    segmentDeadline = 0;
  }

  function previous() {
    pause();
    cursor.value = Math.max(0, cursor.value - 1);
    currentSegmentDuration = 0;
    currentRemainingMilliseconds = 0;
    elapsedInCurrentWord = 0;
    segmentDeadline = 0;
  }

  function seek(index: number) {
    pause();
    cursor.value = Math.max(0, Math.min(words.value.length, Math.round(index)));
    currentSegmentDuration = 0;
    currentRemainingMilliseconds = 0;
    elapsedInCurrentWord = 0;
    segmentDeadline = 0;
  }

  function toggle() {
    if (isPlaying.value) pause();
    else play();
  }

  watch(() => words.value.length, (count) => {
    if (cursor.value > count) seek(count);
  });
  watch(() => durations.value.join(","), (nextSignature, previousSignature) => {
    if (nextSignature === previousSignature || !isPlaying.value) return;
    const wasPlaying = isPlaying.value;
    const oldDuration = Math.max(1, currentSegmentDuration);
    pause();
    const progress = Math.max(0, Math.min(1, elapsedInCurrentWord / oldDuration));
    currentSegmentDuration = durationAt(cursor.value);
    elapsedInCurrentWord = Math.round(currentSegmentDuration * progress);
    currentRemainingMilliseconds = Math.max(1, currentSegmentDuration - elapsedInCurrentWord);
    if (wasPlaying) play();
  }, { flush: "sync" });
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
