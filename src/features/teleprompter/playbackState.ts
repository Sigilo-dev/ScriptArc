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
