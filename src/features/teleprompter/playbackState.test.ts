import { describe, expect, it } from "vitest";
import { advancePlaybackDeadline, calculatePlaybackElapsed, formatPlaybackTime, progressPercentToCursor } from "./playbackState";

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

  it("maps a time-based progress position to the nearest word boundary", () => {
    const cumulative = [0, 100, 600, 800];
    expect(progressPercentToCursor(0, cumulative)).toBe(0);
    expect(progressPercentToCursor(30, cumulative)).toBe(1);
    expect(progressPercentToCursor(70, cumulative)).toBe(2);
    expect(progressPercentToCursor(100, cumulative)).toBe(3);
    expect(progressPercentToCursor(100, [0])).toBe(0);
  });

  it("catches up delayed scheduler callbacks without accumulating drift", () => {
    expect(advancePlaybackDeadline(0, [100, 200, 300], 100, 350)).toEqual({
      cursor: 2,
      deadline: 600,
      elapsedInCurrentWord: 50,
      finished: false,
    });
    expect(advancePlaybackDeadline(0, [100, 200, 300], 100, 600)).toEqual({
      cursor: 3,
      deadline: 600,
      elapsedInCurrentWord: 0,
      finished: true,
    });
  });
});
