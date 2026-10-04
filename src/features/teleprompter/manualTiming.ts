import type { ManualWordTiming } from "../../shared/types";

export type ManualRecordingStatus = "ready" | "recording" | "review";

export interface ManualRecordingSession {
  status: ManualRecordingStatus;
  tokenCount: number;
  cursor: number;
  lastAdvanceAt: number | null;
  timings: ManualWordTiming[];
}

export function createManualRecordingSession(tokenCount: number, timings: ManualWordTiming[] = []): ManualRecordingSession {
  const validTimings = timings.filter((timing) => timing.tokenIndex >= 0 && timing.tokenIndex < tokenCount);
  return {
    status: validTimings.length ? "review" : "ready",
    tokenCount,
    cursor: 0,
    lastAdvanceAt: null,
    timings: validTimings,
  };
}

export function startManualRecording(session: ManualRecordingSession, now: number): ManualRecordingSession {
  if (session.tokenCount === 0) return { ...session, status: "ready", cursor: 0, lastAdvanceAt: null, timings: [] };
  return { ...session, status: "recording", cursor: 0, lastAdvanceAt: now, timings: [] };
}

/** Records the current word's interval and advances once, including at end of script. */
export function advanceManualRecording(session: ManualRecordingSession, now: number): ManualRecordingSession {
  if (session.status !== "recording" || session.lastAdvanceAt === null || session.cursor >= session.tokenCount) return session;
  const timings = upsertManualWordTiming(session.timings, session.cursor, now - session.lastAdvanceAt);
  const cursor = session.cursor + 1;
  return {
    ...session,
    status: cursor >= session.tokenCount ? "review" : "recording",
    cursor,
    lastAdvanceAt: cursor >= session.tokenCount ? null : now,
    timings,
  };
}

/** Rewinds to the prior word and discards only timings that must be recorded again. */
export function retreatManualRecording(session: ManualRecordingSession, now: number): ManualRecordingSession {
  if (session.status !== "recording" || session.cursor === 0) return session;
  const cursor = session.cursor - 1;
  return {
    ...session,
    cursor,
    lastAdvanceAt: now,
    timings: session.timings.filter((timing) => timing.tokenIndex < cursor),
  };
}

/** Ends a recording after the current word, so Stop does not discard its interval. */
export function finishManualRecording(session: ManualRecordingSession, now: number): ManualRecordingSession {
  if (session.status !== "recording") return session;
  if (session.lastAdvanceAt === null || session.cursor >= session.tokenCount) {
    return { ...session, status: "review", lastAdvanceAt: null };
  }
  const timings = upsertManualWordTiming(session.timings, session.cursor, now - session.lastAdvanceAt);
  return { ...session, status: "review", cursor: session.cursor + 1, lastAdvanceAt: null, timings };
}

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
