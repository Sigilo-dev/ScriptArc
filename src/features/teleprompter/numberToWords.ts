import { toCardinal as toEnglishCardinal } from "n2words/en";
import { toCardinal as toSpanishCardinal } from "n2words/es";
import type { Language } from "../../shared/types";

/** Converts ordinary non-negative integers without changing the source token. */
export function numberToWords(value: number, language: Language): string {
  if (!Number.isSafeInteger(value) || value < 0) return String(value);
  return language === "es" ? toSpanishCardinal(value) : toEnglishCardinal(value);
}

/**
 * Converts a grouped integer token while retaining attached punctuation.
 * Decimal forms are deliberately left unchanged because their spoken form is locale-dependent.
 */
export function pronounceNumericToken(token: string, language: Language): string | null {
  const match = /^([¿¡([{“«"']*)([+-]?)(\d{1,3}(?:[.,]\d{3})+|\d+)(%?)([.,;:!?…)}\]”’"'»}]*)$/u.exec(token);
  if (!match) return null;

  const [, prefix, sign, digits, percent, punctuation] = match;
  const value = digits.replace(/[.,]/gu, "");
  const cardinal = language === "es" ? toSpanishCardinal : toEnglishCardinal;
  const signWord = sign === "-" ? (language === "es" ? "menos " : "minus ") : sign === "+" ? (language === "es" ? "más " : "plus ") : "";
  const percentWord = percent ? (language === "es" ? " por ciento" : " percent") : "";
  return `${prefix}${signWord}${cardinal(value)}${percentWord}${punctuation}`;
}
