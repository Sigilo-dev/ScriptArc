import { describe, expect, it } from "vitest";
import { calculatePlaybackElapsed, formatPlaybackTime } from "./playbackState";

describe("playback state helpers", () => {
  it("calculates elapsed time for a current word and the finished script", () => {
    expect(calculatePlaybackElapsed([500, 800, 700], 1, 300)).toBe(800);
    expect(calculatePlaybackElapsed([500, 800, 700], 3)).toBe(2000);
    expect(calculatePlaybackElapsed([500], 0, 900)).toBe(500);
  });

  it("formats elapsed durations as minutes and seconds", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(61_900)).toBe("1:01");
  });
});
