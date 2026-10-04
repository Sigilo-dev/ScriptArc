import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { ScriptProject } from "../../shared/types";
import { deserializeProject, serializeProject } from "./projectModel";

export const RECOVERY_DRAFT_KEY = "scriptarc.recovery.v1";

export interface OpenedProject {
  project: ScriptProject;
  filePath: string | null;
}

export interface RecoveryDraft {
  project: ScriptProject;
  filePath: string | null;
  baselineFingerprint: string;
}

type ProjectStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export async function openProjectFile(): Promise<OpenedProject | null> {
  if (isTauri()) {
    const selected = await open({
      multiple: false,
      filters: [{ name: "ScriptArc", extensions: ["scriptarc"] }],
    });
    if (typeof selected !== "string") return null;
    return { project: deserializeProject(await readTextFile(selected)), filePath: selected };
  }

  const file = await chooseBrowserFile();
  if (!file) return null;
  return { project: deserializeProject(await file.text()), filePath: null };
}

export async function saveProjectFile(project: ScriptProject, currentFilePath: string | null, saveAs = false): Promise<string | null> {
  const content = serializeProject(project);
  if (isTauri()) {
    const selected = (!saveAs ? currentFilePath : null) ?? await save({
      defaultPath: saveAs && currentFilePath ? currentFilePath : `${safeFileName(project.title)}.scriptarc`,
      filters: [{ name: "ScriptArc", extensions: ["scriptarc"] }],
    });
    if (!selected) return null;
    const projectPath = selected.toLowerCase().endsWith(".scriptarc") ? selected : `${selected}.scriptarc`;
    await writeTextFile(projectPath, content);
    return projectPath;
  }

  downloadBrowserFile(content, `${safeFileName(project.title)}.scriptarc`);
  return null;
}

export function projectFingerprint(project: ScriptProject): string {
  return JSON.stringify(Object.fromEntries(Object.entries(project).filter(([key]) => key !== "updatedAt")));
}

export function saveRecoveryDraft(
  project: ScriptProject,
  filePath: string | null,
  baselineFingerprint: string,
  storage: ProjectStorage = window.localStorage,
): void {
  storage.setItem(RECOVERY_DRAFT_KEY, JSON.stringify({
    formatVersion: 1,
    project,
    filePath,
    baselineFingerprint,
  }));
}

export function loadRecoveryDraft(storage: ProjectStorage = window.localStorage): RecoveryDraft | null {
  let serialized: string | null;
  try { serialized = storage.getItem(RECOVERY_DRAFT_KEY); } catch { return null; }
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized) as unknown;
    if (!isRecord(value) || value.formatVersion !== 1 || typeof value.baselineFingerprint !== "string"
      || (value.filePath !== null && typeof value.filePath !== "string")) {
      throw new Error("Invalid recovery draft");
    }
    return {
      project: deserializeProject(JSON.stringify(value.project)),
      filePath: value.filePath,
      baselineFingerprint: value.baselineFingerprint,
    };
  } catch {
    storage.removeItem(RECOVERY_DRAFT_KEY);
    return null;
  }
}

export function clearRecoveryDraft(storage: ProjectStorage = window.localStorage): void {
  storage.removeItem(RECOVERY_DRAFT_KEY);
}

function chooseBrowserFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".scriptarc,application/json";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

function downloadBrowserFile(content: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileName(title: string): string {
  const withoutControls = [...title.trim()].filter((character) => character.charCodeAt(0) >= 32).join("");
  return withoutControls.replace(/[<>:"/\\|?*]/gu, "-").slice(0, 80) || "guion";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
