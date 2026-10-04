import { describe, expect, it } from "vitest";
import { createProject } from "./projectModel";
import { clearRecoveryDraft, loadRecoveryDraft, projectFingerprint, RECOVERY_DRAFT_KEY, saveRecoveryDraft } from "./projectPersistence";

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

describe("local project recovery", () => {
  it("restores a recovery snapshot without confusing its source file with the unsaved contents", () => {
    const storage = new MemoryStorage();
    const project = createProject("Recover me");
    saveRecoveryDraft(project, "E:\\talk.scriptarc", "saved-version", storage);
    expect(loadRecoveryDraft(storage)).toEqual({ project, filePath: "E:\\talk.scriptarc", baselineFingerprint: "saved-version" });
    clearRecoveryDraft(storage);
    expect(storage.getItem(RECOVERY_DRAFT_KEY)).toBeNull();
  });

  it("fingerprints project content without treating save timestamps as edits", () => {
    const project = createProject("Hello");
    expect(projectFingerprint({ ...project, updatedAt: "later" })).toBe(projectFingerprint(project));
    expect(projectFingerprint({ ...project, sourceMarkdown: "Changed" })).not.toBe(projectFingerprint(project));
  });

  it("discards corrupt recovery data instead of opening it", () => {
    const storage = new MemoryStorage();
    storage.setItem(RECOVERY_DRAFT_KEY, JSON.stringify({ formatVersion: 1, project: { formatVersion: 99 } }));
    expect(loadRecoveryDraft(storage)).toBeNull();
    expect(storage.getItem(RECOVERY_DRAFT_KEY)).toBeNull();
  });
});
