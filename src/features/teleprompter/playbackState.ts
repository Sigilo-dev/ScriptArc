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

export function formatPlaybackTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
