export function calculatePlaybackElapsed(
  durations: number[],
  cursor: number,
  currentWordElapsedMilliseconds = 0,
): number {
  const completedCount = Math.max(0, Math.min(durations.length, cursor));
  const completedMilliseconds = durations.slice(0, completedCount).reduce((total, duration) => total + duration, 0);
  const currentDuration = durations[completedCount] ?? 0;
  return completedMilliseconds + Math.max(0, Math.min(currentDuration, currentWordElapsedMilliseconds));
}

export interface PlaybackDeadlineResult {
  cursor: number;
  deadline: number;
  elapsedInCurrentWord: number;
  finished: boolean;
}

/** Returns the closest word boundary for a percentage on the full reading timeline. */
export function progressPercentToCursor(progressPercent: number, cumulativeDurations: readonly number[]): number {
  const finalBoundary = cumulativeDurations.length - 1;
  if (finalBoundary <= 0) return 0;
  const totalDuration = cumulativeDurations[finalBoundary] ?? 0;
  if (totalDuration <= 0) return 0;
  const targetTime = totalDuration * Math.max(0, Math.min(100, progressPercent)) / 100;
  let low = 0;
  let high = finalBoundary;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((cumulativeDurations[middle] ?? 0) < targetTime) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return 0;
  const previousBoundary = cumulativeDurations[low - 1] ?? 0;
  const nextBoundary = cumulativeDurations[low] ?? totalDuration;
  return targetTime - previousBoundary <= nextBoundary - targetTime ? low - 1 : low;
}

/** Advances over delayed timer callbacks while preserving the original timeline. */
export function advancePlaybackDeadline(
  cursor: number,
  durations: readonly number[],
  deadline: number,
  now: number,
): PlaybackDeadlineResult {
  if (cursor >= durations.length) {
    return { cursor: durations.length, deadline, elapsedInCurrentWord: 0, finished: true };
  }

  let nextCursor = cursor;
  let nextDeadline = deadline;
  while (now >= nextDeadline) {
    nextCursor += 1;
    if (nextCursor >= durations.length) {
      return { cursor: durations.length, deadline: nextDeadline, elapsedInCurrentWord: 0, finished: true };
    }
    nextDeadline += Math.max(1, durations[nextCursor]);
  }

  const elapsedInCurrentWord = Math.max(0, now - (nextDeadline - Math.max(1, durations[nextCursor])));
  return { cursor: nextCursor, deadline: nextDeadline, elapsedInCurrentWord, finished: false };
}

export function formatPlaybackTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
