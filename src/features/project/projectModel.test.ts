import { describe, expect, it } from "vitest";
import { createProject, deserializeProject, serializeProject, updateProjectMarkdown } from "./projectModel";

describe("project model", () => {
  it("creates a versioned project with defaults and a Markdown-derived title", () => {
    const project = createProject("## Presentación\n\nHola.", new Date("2026-01-02T03:04:05.000Z"));
    expect(project.formatVersion).toBe(2);
    expect(project.title).toBe("Presentación");
    expect(project.sourceMarkdown).toBe("## Presentación\n\nHola.");
    expect(project.lastPosition).toBe(0);
    expect(project.teleprompterSettings.fontSize).toBe(56);
    expect(project.automaticTiming.language).toBe("es");
  });

  it("keeps the Markdown unchanged when the project is updated and serialized", () => {
    const original = "## Title\n\nThis is **important**.";
    const project = { ...createProject(original), lastPosition: 3 };
    const updated = updateProjectMarkdown(project, original);
    expect(deserializeProject(serializeProject(updated))).toMatchObject({ sourceMarkdown: original, lastPosition: 3 });
  });

  it("clears word timings after source Markdown changes", () => {
    const project = { ...createProject("one two"), lastPosition: 1, manualTimings: [{ tokenIndex: 0, durationMilliseconds: 500 }] };
    expect(updateProjectMarkdown(project, "one changed")).toMatchObject({ manualTimings: [], lastPosition: 0 });
  });

  it("migrates the first legacy format into the current version", () => {
    const migrated = deserializeProject(JSON.stringify({ formatVersion: 0, markdown: "Hello", mode: "manual", language: "en" }));
    expect(migrated.formatVersion).toBe(2);
    expect(migrated.sourceMarkdown).toBe("Hello");
    expect(migrated.timingMode).toBe("manual");
    expect(migrated.automaticTiming.language).toBe("en");
  });

  it("rejects malformed and unsupported project files", () => {
    expect(() => deserializeProject("no json")).toThrow("no contiene un proyecto");
    expect(() => deserializeProject('{"formatVersion":99}')).toThrow("futura incompatible");
    expect(() => deserializeProject('{"formatVersion":-1}')).toThrow("no está soportada");
  });

  it("migrates version 1 settings without retaining the global theme in the project", () => {
    const current = createProject("Hola.");
    const migrated = deserializeProject(JSON.stringify({
      ...current,
      formatVersion: 1,
      preferences: { theme: "pink", fontSize: 64, lineHeight: 1.4, wordsPerMinute: 180 },
      automaticTiming: { ...current.automaticTiming, wordsPerMinute: undefined },
    }));
    expect(migrated.teleprompterSettings.fontSize).toBe(64);
    expect(migrated.automaticTiming.wordsPerMinute).toBe(180);
    expect("preferences" in migrated).toBe(false);
  });

  it("rejects malformed manual timing records and invalid current schema", () => {
    const project = createProject("Hola.");
    expect(() => deserializeProject(JSON.stringify({
      ...project,
      manualTimings: [{ tokenIndex: 0, durationMilliseconds: 1 }],
    }))).toThrow("tiempos manuales");
  });

  it("rejects manual timing indexes that do not exist in the parsed script", () => {
    const project = createProject("Hola.");
    expect(() => deserializeProject(JSON.stringify({
      ...project,
      manualTimings: [{ tokenIndex: 2, durationMilliseconds: 500 }],
    }))).toThrow("no coinciden");
  });

  it("rejects a saved playback position beyond the final word", () => {
    const project = createProject("Word.");
    expect(() => deserializeProject(JSON.stringify({ ...project, lastPosition: 2 }))).toThrow("posición guardada");
  });
});
