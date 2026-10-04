import { describe, expect, it } from "vitest";
import { createProject } from "./projectModel";
import { LOCAL_PROJECT_KEY, loadLocalProject, saveLocalProject } from "./projectPersistence";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("local project storage", () => {
  it("stores and restores a versioned script project", () => {
    const storage = new MemoryStorage();
    const project = createProject("## Local\nTexto.");
    saveLocalProject(project, storage);
    expect(storage.getItem(LOCAL_PROJECT_KEY)).toContain('"formatVersion": 1');
    expect(loadLocalProject(storage)?.sourceMarkdown).toBe(project.sourceMarkdown);
  });

  it("discards a corrupted draft and returns an empty state", () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_PROJECT_KEY, "corrupted data");
    expect(loadLocalProject(storage)).toBeNull();
    expect(storage.getItem(LOCAL_PROJECT_KEY)).toBeNull();
  });
});
