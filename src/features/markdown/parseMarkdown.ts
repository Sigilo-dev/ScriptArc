import type { MarkdownBlock, MarkdownToken, ParsedMarkdownDocument } from "../../shared/types";

interface VisibleRun {
  text: string;
  emphasis: MarkdownToken["emphasis"];
  sourceStart: number;
}

export function parseMarkdown(sourceMarkdown: string): ParsedMarkdownDocument {
  const blocks: MarkdownBlock[] = [];
  const tokens: MarkdownToken[] = [];
  let absoluteOffset = 0;

  for (const sourceLine of sourceMarkdown.split(/\r?\n/u)) {
    const lineOffset = absoluteOffset;
    absoluteOffset += sourceLine.length + 1;
    const line = sourceLine.trimEnd();
    if (!line.trim()) continue;

    const prepared = prepareBlock(line);
    if (!prepared.content.trim()) continue;
    const tokenStart = tokens.length;
    const runs = tokenizeInline(prepared.content, lineOffset + prepared.contentOffset);
    const visibleLine = runs.map((run) => run.text).join("");
    const runRanges = runs.reduce<Array<VisibleRun & { visibleStart: number; visibleEnd: number }>>((ranges, run) => {
      const visibleStart = ranges.length ? ranges[ranges.length - 1].visibleEnd : 0;
      ranges.push({ ...run, visibleStart, visibleEnd: visibleStart + run.text.length });
      return ranges;
    }, []);
    for (const match of visibleLine.matchAll(/\S+/gu)) {
      const word = match[0];
      const wordStart = match.index ?? 0;
      const wordEnd = wordStart + word.length;
      const overlappingRuns = runRanges.filter((run) => run.visibleStart < wordEnd && run.visibleEnd > wordStart);
      const firstRun = overlappingRuns[0];
      const lastRun = overlappingRuns[overlappingRuns.length - 1];
      tokens.push({
        index: tokens.length,
        visibleText: word,
        spokenText: word,
        sourceStart: firstRun.sourceStart + Math.max(0, wordStart - firstRun.visibleStart),
        sourceEnd: lastRun.sourceStart + Math.min(lastRun.text.length, wordEnd - lastRun.visibleStart),
        emphasis: overlappingRuns.find((run) => run.emphasis !== null)?.emphasis ?? null,
        punctuation: punctuationAfter(word),
      });
    }
    blocks.push({
      kind: prepared.kind,
      ...(prepared.level ? { level: prepared.level } : {}),
      visibleText: visibleLine,
      tokenStart,
      tokenEnd: tokens.length,
    });
  }

  const visibleText = blocks.map((block) => block.visibleText).join("\n");
  return {
    sourceMarkdown,
    visibleText,
    spokenText: tokens.map((token) => token.spokenText).join(" "),
    blocks,
    tokens,
  };
}

function prepareBlock(line: string): { kind: MarkdownBlock["kind"]; level?: number; content: string; contentOffset: number } {
  const heading = /^(#{1,6})\s+(.*)$/u.exec(line);
  if (heading) {
    const prefixLength = heading[1].length + 1;
    return { kind: "heading", level: heading[1].length, content: heading[2], contentOffset: prefixLength };
  }
  const quote = /^>\s?(.*)$/u.exec(line);
  if (quote) return { kind: "quote", content: quote[1], contentOffset: line.indexOf(quote[1]) };
  const listItem = /^(?:[-+*]\s+|\d+[.)]\s+)(.*)$/u.exec(line);
  if (listItem) return { kind: "list-item", content: listItem[1], contentOffset: line.indexOf(listItem[1]) };
  return { kind: "paragraph", content: line, contentOffset: 0 };
}

function tokenizeInline(source: string, absoluteStart: number): VisibleRun[] {
  const normalized = source
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1");
  const runs: VisibleRun[] = [];
  const syntax = /(\*\*|__)(.+?)\1|(~~)(.+?)\3|(\*|_)(.+?)\5/gu;
  let cursor = 0;
  for (const match of normalized.matchAll(syntax)) {
    const start = match.index ?? 0;
    if (start > cursor) runs.push({ text: normalized.slice(cursor, start), emphasis: null, sourceStart: absoluteStart + cursor });
    const marker = match[1] ?? match[3] ?? match[5];
    const text = match[2] ?? match[4] ?? match[6] ?? "";
    const emphasis: MarkdownToken["emphasis"] = marker === "~~" ? "strikethrough" : marker.length === 2 ? "strong" : "emphasis";
    runs.push({ text, emphasis, sourceStart: absoluteStart + start + marker.length });
    cursor = start + match[0].length;
  }
  if (cursor < normalized.length) runs.push({ text: normalized.slice(cursor), emphasis: null, sourceStart: absoluteStart + cursor });
  return runs;
}

function punctuationAfter(word: string): MarkdownToken["punctuation"] {
  if (/[.!?…][”’"')\]]*$/u.test(word)) return "sentence";
  if (/;[”’"')\]]*$/u.test(word)) return "semicolon";
  if (/,[”’"')\]]*$/u.test(word)) return "comma";
  return null;
}
