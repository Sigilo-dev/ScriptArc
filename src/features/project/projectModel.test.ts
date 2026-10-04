import { describe, expect, it } from "vitest";
import { createProject, deserializeProject, serializeProject, updateProjectMarkdown } from "./projectModel";

describe("project model", () => {
  it("creates a versioned project with defaults and a Markdown-derived title", () => {
    const project = createProject("## Presentación\n\nHola.", new Date("2026-01-02T03:04:05.000Z"));
    expect(project.formatVersion).toBe(1);
    expect(project.title).toBe("Presentación");
    expect(project.sourceMarkdown).toBe("## Presentación\n\nHola.");
    expect(project.preferences.theme).toBe("white");
    expect(project.automaticTiming.language).toBe("es");
  });

  it("keeps the Markdown unchanged when the project is updated and serialized", () => {
    const original = "## Title\n\nThis is **important**.";
    const project = createProject(original);
    const updated = updateProjectMarkdown(project, original);
    expect(deserializeProject(serializeProject(updated)).sourceMarkdown).toBe(original);
  });

  it("migrates the first legacy format into the current version", () => {
    const migrated = deserializeProject(JSON.stringify({ formatVersion: 0, markdown: "Hello", mode: "manual", language: "en" }));
    expect(migrated.formatVersion).toBe(1);
    expect(migrated.sourceMarkdown).toBe("Hello");
    expect(migrated.timingMode).toBe("manual");
    expect(migrated.automaticTiming.language).toBe("en");
  });

  it("rejects malformed and unsupported project files", () => {
    expect(() => deserializeProject("no json")).toThrow("no contiene un proyecto");
    expect(() => deserializeProject('{"formatVersion":99}')).toThrow("no compatible");
  });
});
