import type { ThemeId } from "../../shared/types";

export interface ThemeOption {
  id: ThemeId;
  label: string;
  color: string;
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  { id: "white", label: "Claro blanco", color: "#ffffff" },
  { id: "gray", label: "Claro gris", color: "#e8ebef" },
  { id: "orange", label: "Naranja", color: "#e87924" },
  { id: "blue", label: "Azul", color: "#2563eb" },
  { id: "pink", label: "Rosa", color: "#db2777" },
  { id: "black", label: "Oscuro negro puro", color: "#000000" },
];

export function isThemeId(value: string): value is ThemeId {
  return THEME_OPTIONS.some((theme) => theme.id === value);
}
