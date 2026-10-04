import type { ThemeId, ThemePalette } from "../../shared/types";

export type PresetThemeId = Exclude<ThemeId, "custom">;

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
  { id: "custom", label: "Personalizado", color: "#6d5dfc" },
];

export const THEME_PALETTES: Readonly<Record<PresetThemeId, ThemePalette>> = {
  white: {
    surface: "#ffffff", surfaceMuted: "#f7f9fc", text: "#182230", textSoft: "#677487",
    line: "#e8edf3", accent: "#2563eb", accentSoft: "#eaf1ff", prompterBg: "#071a35",
    prompterMuted: "#84a0c5", prompterTextColor: "#91d8ee", prompterCurrentColor: "#ffffff",
    prompterSpokenColor: "#d35062",
  },
  gray: {
    surface: "#eef0f3", surfaceMuted: "#e5e8ec", text: "#202a36", textSoft: "#657181",
    line: "#d5dbe2", accent: "#34465d", accentSoft: "#dce3ec", prompterBg: "#131a22",
    prompterMuted: "#a0adbb", prompterTextColor: "#c5d0dc", prompterCurrentColor: "#ffffff",
    prompterSpokenColor: "#df7380",
  },
  orange: {
    surface: "#fff8f0", surfaceMuted: "#fff0e0", text: "#3a2415", textSoft: "#81634b",
    line: "#f0d3b5", accent: "#e87924", accentSoft: "#ffead2", prompterBg: "#251307",
    prompterMuted: "#d0a67f", prompterTextColor: "#f5c18b", prompterCurrentColor: "#ffffff",
    prompterSpokenColor: "#f4717b",
  },
  blue: {
    surface: "#f5f8ff", surfaceMuted: "#edf3ff", text: "#102951", textSoft: "#5f7395",
    line: "#d7e3f5", accent: "#2563eb", accentSoft: "#e2ecff", prompterBg: "#061735",
    prompterMuted: "#89a8d8", prompterTextColor: "#94c9ff", prompterCurrentColor: "#ffffff",
    prompterSpokenColor: "#e46e85",
  },
  pink: {
    surface: "#fff7fa", surfaceMuted: "#ffedf3", text: "#4b1d32", textSoft: "#896578",
    line: "#f2d7e3", accent: "#db2777", accentSoft: "#ffe2ee", prompterBg: "#2b1022",
    prompterMuted: "#d49ab7", prompterTextColor: "#ffb1cd", prompterCurrentColor: "#ffffff",
    prompterSpokenColor: "#ff7c91",
  },
  black: {
    surface: "#000000", surfaceMuted: "#080808", text: "#f5f5f5", textSoft: "#a1a1aa",
    line: "#252525", accent: "#60a5fa", accentSoft: "#102a47", prompterBg: "#000000",
    prompterMuted: "#858585", prompterTextColor: "#9bcaff", prompterCurrentColor: "#ffffff",
    prompterSpokenColor: "#ed7182",
  },
};

export function isThemeId(value: string): value is ThemeId {
  return THEME_OPTIONS.some((theme) => theme.id === value);
}
