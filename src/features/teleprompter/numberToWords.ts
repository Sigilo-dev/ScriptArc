import type { Language } from "../../shared/types";

const spanishSmall = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const spanishTens = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const spanishHundreds = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
const englishSmall = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const englishTens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberToWords(value: number, language: Language): string {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 1_000_000_000_000) return String(value);
  if (language === "en") return englishNumber(value);
  return spanishNumber(value);
}

export function pronounceNumericToken(token: string, language: Language): string | null {
  const match = /^([^\d]*)([+-]?)(\d+(?:[.,]\d{3})*)([^\d]*)$/u.exec(token);
  if (!match) return null;
  const [, prefix, sign, digits, suffix] = match;
  const value = Number(digits.replace(/[.,]/gu, ""));
  if (!Number.isSafeInteger(value) || value >= 1_000_000_000_000) return null;
  const signWord = sign === "-" ? (language === "es" ? "menos " : "minus ") : sign === "+" ? (language === "es" ? "más " : "plus ") : "";
  const words = `${prefix}${signWord}${numberToWords(value, language)}`.trim();
  return `${words}${suffix}`;
}

function spanishNumber(value: number): string {
  if (value < 1000) return spanishUnderThousand(value, false);
  const parts: string[] = [];
  const billions = Math.floor(value / 1_000_000_000);
  const millions = Math.floor((value % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1000);
  const units = value % 1000;
  if (billions) parts.push(`${billions === 1 ? "mil" : `${spanishUnderThousand(billions, true)} mil`} millones`);
  if (millions) parts.push(`${millions === 1 ? "un" : spanishUnderThousand(millions, true)} millón${millions === 1 ? "" : "es"}`);
  if (thousands) parts.push(`${thousands === 1 ? "" : `${spanishUnderThousand(thousands, true)} `}mil`);
  if (units) parts.push(spanishUnderThousand(units, false));
  return parts.join(" ");
}

function spanishUnderThousand(value: number, masculine: boolean): string {
  if (value < 30) return masculine ? masculineOne(spanishSmall[value]) : spanishSmall[value];
  if (value < 100) {
    const tens = spanishTens[Math.floor(value / 10)];
    const units = value % 10;
    return units ? `${tens} y ${masculine ? masculineOne(spanishSmall[units]) : spanishSmall[units]}` : tens;
  }
  if (value === 100) return "cien";
  const hundreds = spanishHundreds[Math.floor(value / 100)];
  const remainder = value % 100;
  return remainder ? `${hundreds} ${spanishUnderThousand(remainder, masculine)}` : hundreds;
}

function masculineOne(phrase: string): string {
  if (phrase === "uno") return "un";
  if (phrase === "veintiuno") return "veintiún";
  return phrase.replace(/ y uno$/u, " y un");
}

function englishNumber(value: number): string {
  if (value < 1000) return englishUnderThousand(value);
  const parts: string[] = [];
  const billions = Math.floor(value / 1_000_000_000);
  const millions = Math.floor((value % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1000);
  const units = value % 1000;
  if (billions) parts.push(`${englishUnderThousand(billions)} billion`);
  if (millions) parts.push(`${englishUnderThousand(millions)} million`);
  if (thousands) parts.push(`${englishUnderThousand(thousands)} thousand`);
  if (units) parts.push(englishUnderThousand(units));
  return parts.join(" ");
}

function englishUnderThousand(value: number): string {
  if (value < 20) return englishSmall[value];
  if (value < 100) {
    const tens = englishTens[Math.floor(value / 10)];
    const units = value % 10;
    return units ? `${tens}-${englishSmall[units]}` : tens;
  }
  const hundreds = `${englishSmall[Math.floor(value / 100)]} hundred`;
  const remainder = value % 100;
  return remainder ? `${hundreds} ${englishUnderThousand(remainder)}` : hundreds;
}
