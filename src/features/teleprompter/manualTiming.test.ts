import { describe, expect, it } from "vitest";
import { manualWordDuration, upsertManualWordTiming } from "./manualTiming";

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
});
