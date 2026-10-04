import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { ScriptProject } from "../../shared/types";
import { deserializeProject, serializeProject } from "./projectModel";

export const LOCAL_PROJECT_KEY = "scriptarc.local-project.v1";

export interface OpenedProject {
  project: ScriptProject;
  filePath: string | null;
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

export async function saveProjectFile(project: ScriptProject, currentFilePath: string | null): Promise<string | null> {
  const content = serializeProject(project);
  if (isTauri()) {
    const selected = currentFilePath ?? await save({
      defaultPath: `${safeFileName(project.title)}.scriptarc`,
      filters: [{ name: "ScriptArc", extensions: ["scriptarc"] }],
    });
    if (!selected) return null;
    await writeTextFile(selected, content);
    return selected;
  }

  downloadBrowserFile(content, `${safeFileName(project.title)}.scriptarc`);
  return null;
}

export function loadLocalProject(storage: ProjectStorage = window.localStorage): ScriptProject | null {
  const serialized = storage.getItem(LOCAL_PROJECT_KEY);
  if (!serialized) return null;
  try {
    return deserializeProject(serialized);
  } catch {
    storage.removeItem(LOCAL_PROJECT_KEY);
    return null;
  }
}

export function saveLocalProject(project: ScriptProject, storage: ProjectStorage = window.localStorage): void {
  storage.setItem(LOCAL_PROJECT_KEY, serializeProject(project));
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
