import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../markdown/parseMarkdown";
import {
  advanceManualRecording,
  createManualRecordingSession,
  finishManualRecording,
  manualWordDuration,
  retreatManualRecording,
  startManualRecording,
  upsertManualWordTiming,
} from "./manualTiming";

describe("manual timing", () => {
  it("clamps recorded intervals and keeps one sorted timing per token", () => {
    const timings = upsertManualWordTiming([{ tokenIndex: 3, durationMilliseconds: 900 }], 1, 120);
    expect(timings).toEqual([
      { tokenIndex: 1, durationMilliseconds: 250 },
      { tokenIndex: 3, durationMilliseconds: 900 },
    ]);
    expect(upsertManualWordTiming(timings, 1, 7200)[0].durationMilliseconds).toBe(6000);
  });

  it("uses the recorded duration or a calculated fallback", () => {
    const timings = [{ tokenIndex: 0, durationMilliseconds: 840 }];
    expect(manualWordDuration(timings, 0, 400)).toBe(840);
    expect(manualWordDuration(timings, 2, 400)).toBe(400);
  });

  it("records every word and completes on the final word without a punctuation step", () => {
    let session = startManualRecording(createManualRecordingSession(2), 1000);
    session = advanceManualRecording(session, 1500);
    expect(session).toMatchObject({ status: "recording", cursor: 1 });
    session = advanceManualRecording(session, 2200);
    expect(session).toMatchObject({ status: "review", cursor: 2, lastAdvanceAt: null });
    expect(session.timings).toEqual([
      { tokenIndex: 0, durationMilliseconds: 500 },
      { tokenIndex: 1, durationMilliseconds: 700 },
    ]);
    expect(advanceManualRecording(session, 2400)).toBe(session);
  });

  it("needs one advance for the final word even when it owns the document period", () => {
    const words = parseMarkdown("Buenos días.").tokens;
    let session = startManualRecording(createManualRecordingSession(words.length), 1000);
    expect(words.map(({ displayText }) => displayText)).toEqual(["Buenos", "días."]);
    session = advanceManualRecording(session, 1500);
    session = advanceManualRecording(session, 2200);
    expect(session.status).toBe("review");
    expect(session.timings).toHaveLength(2);
    expect(session.cursor).toBe(words.length);
  });

  it("rewinds without retaining timings for words that need to be rerecorded", () => {
    let session = startManualRecording(createManualRecordingSession(3), 1000);
    session = advanceManualRecording(session, 1600);
    session = advanceManualRecording(session, 2300);
    session = retreatManualRecording(session, 2500);
    expect(session).toMatchObject({ status: "recording", cursor: 1, lastAdvanceAt: 2500 });
    expect(session.timings).toEqual([{ tokenIndex: 0, durationMilliseconds: 600 }]);
    session = advanceManualRecording(session, 3200);
    expect(session.timings).toEqual([
      { tokenIndex: 0, durationMilliseconds: 600 },
      { tokenIndex: 1, durationMilliseconds: 700 },
    ]);
  });

  it("captures the current word when recording is stopped early", () => {
    let session = startManualRecording(createManualRecordingSession(3), 500);
    session = advanceManualRecording(session, 1000);
    session = finishManualRecording(session, 1650);
    expect(session).toMatchObject({ status: "review", cursor: 2, lastAdvanceAt: null });
    expect(session.timings).toEqual([
      { tokenIndex: 0, durationMilliseconds: 500 },
      { tokenIndex: 1, durationMilliseconds: 650 },
    ]);
  });
});
