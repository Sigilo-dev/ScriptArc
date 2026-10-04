import type { ManualWordTiming } from "../../shared/types";

export function upsertManualWordTiming(
  timings: ManualWordTiming[],
  tokenIndex: number,
  elapsedMilliseconds: number,
): ManualWordTiming[] {
  const timing: ManualWordTiming = {
    tokenIndex,
    durationMilliseconds: Math.max(250, Math.min(6000, Math.round(elapsedMilliseconds))),
  };
  return [...timings.filter((saved) => saved.tokenIndex !== tokenIndex), timing]
    .sort((first, second) => first.tokenIndex - second.tokenIndex);
}

export function manualWordDuration(
  timings: ManualWordTiming[],
  tokenIndex: number,
  fallbackMilliseconds: number,
): number {
  return timings.find((timing) => timing.tokenIndex === tokenIndex)?.durationMilliseconds ?? fallbackMilliseconds;
}
