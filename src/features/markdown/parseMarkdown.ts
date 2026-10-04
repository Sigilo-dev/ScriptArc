import type { MarkdownBlock, MarkdownToken, ParsedMarkdownDocument } from "../../shared/types";

type EmphasisStyle = NonNullable<MarkdownToken["emphasis"]>;

interface InlineRun {
  text: string;
  emphasisStyles: EmphasisStyle[];
  sourceStart: number;
}

interface PreparedBlock {
  kind: MarkdownBlock["kind"];
  level?: number;
  content: string;
  contentOffset: number;
}

interface TokenCandidate {
  text: string;
  start: number;
  end: number;
}

/** Parses presentation Markdown while keeping sourceMarkdown as the canonical source. */
export function parseMarkdown(sourceMarkdown: string): ParsedMarkdownDocument {
  const blocks: MarkdownBlock[] = [];
  const tokens: MarkdownToken[] = [];
  let lineOffset = 0;

  const sourceLines = sourceMarkdown.split(/\r?\n/u);
  const newlineLengths = [...sourceMarkdown.matchAll(/\r?\n/gu)].map((match) => match[0].length);
  for (const [lineIndex, sourceLine] of sourceLines.entries()) {
    const line = sourceLine.trimEnd();
    if (line.trim()) {
      const prepared = prepareBlock(line);
      if (prepared.content.trim()) {
        const tokenStart = tokens.length;
        const runs = parseInline(prepared.content, lineOffset + prepared.contentOffset);
        const visibleLine = runs.map((run) => run.text).join("");
        const candidates = wordCandidates(visibleLine);
        const runRanges = getRunRanges(runs);
        let pendingPrefix = "";
        let pendingPrefixStart: number | null = null;

        for (const candidate of candidates) {
          if (isOpeningPunctuation(candidate.text)) {
            pendingPrefixStart ??= candidate.start;
            pendingPrefix += candidate.text;
            continue;
          }

          if (isClosingPunctuation(candidate.text)) {
            const previous = tokens[tokens.length - 1];
            if (previous && previous.index >= tokenStart) {
              previous.displayText += candidate.text;
              previous.visibleText = previous.displayText;
              previous.spokenText += candidate.text;
              previous.sourceEnd = sourceEndForVisibleOffset(runRanges, candidate.end);
              previous.punctuation = punctuationAfter(previous.displayText);
            }
            continue;
          }

          const displayText = pendingPrefix + candidate.text;
          const prefixStart = pendingPrefixStart;
          pendingPrefix = "";
          pendingPrefixStart = null;
          const overlappingRuns = runRanges.filter((run) => run.visibleStart < candidate.end && run.visibleEnd > candidate.start);
          const styles = [...new Set(overlappingRuns.flatMap((run) => run.emphasisStyles))];
          const firstRun = overlappingRuns[0];
          const lastRun = overlappingRuns[overlappingRuns.length - 1];
          const startOffset = prefixStart !== null
            ? sourceOffsetForVisibleOffset(runRanges, prefixStart)
            : firstRun
            ? firstRun.sourceStart + Math.max(0, candidate.start - firstRun.visibleStart)
            : lineOffset + prepared.contentOffset + candidate.start;
          const endOffset = lastRun
            ? lastRun.sourceStart + Math.min(lastRun.text.length, candidate.end - lastRun.visibleStart)
            : startOffset + candidate.text.length;
          const token: MarkdownToken = {
            index: tokens.length,
            displayText,
            visibleText: displayText,
            spokenText: displayText,
            sourceStart: Math.max(0, startOffset),
            sourceEnd: endOffset,
            emphasis: styles[0] ?? null,
            emphasisStyles: styles,
            punctuation: punctuationAfter(displayText),
          };
          tokens.push(token);
        }

        blocks.push({
          kind: prepared.kind,
          ...(prepared.level ? { level: prepared.level } : {}),
          visibleText: visibleLine,
          tokenStart,
          tokenEnd: tokens.length,
        });
      }
    }
    lineOffset += sourceLine.length;
    lineOffset += newlineLengths[lineIndex] ?? 0;
  }

  return {
    sourceMarkdown,
    visibleText: blocks.map((block) => block.visibleText).join("\n"),
    spokenText: tokens.map((token) => token.spokenText).join(" "),
    blocks,
    tokens,
  };
}

function prepareBlock(line: string): PreparedBlock {
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

function parseInline(source: string, sourceOffset: number, inherited: EmphasisStyle[] = []): InlineRun[] {
  const runs: InlineRun[] = [];
  const append = (text: string, start: number, styles = inherited) => {
    if (!text) return;
    const previous = runs[runs.length - 1];
    if (previous && sameStyles(previous.emphasisStyles, styles) && previous.sourceStart + previous.text.length === start) {
      previous.text += text;
    } else {
      runs.push({ text, emphasisStyles: [...styles], sourceStart: start });
    }
  };

  let cursor = 0;
  while (cursor < source.length) {
    const remainder = source.slice(cursor);
    const imageOrLink = /^(?:!\[([^\]]*)\]\([^)]*\)|\[([^\]]+)\]\([^)]*\))/u.exec(remainder);
    if (imageOrLink) {
      const label = imageOrLink[1] ?? imageOrLink[2] ?? "";
      const labelOffset = imageOrLink[0].indexOf(label);
      for (const run of parseInline(label, sourceOffset + cursor + labelOffset, inherited)) {
        append(run.text, run.sourceStart, run.emphasisStyles);
      }
      cursor += imageOrLink[0].length;
      continue;
    }

    // Raw HTML is deliberately treated as non-content. The renderer also uses text nodes only.
    const rawHtmlTag = /^<\/?[A-Za-z][^>]*>/u.exec(remainder);
    if (rawHtmlTag) {
      cursor += rawHtmlTag[0].length;
      continue;
    }

    const code = /^`([^`]+)`/u.exec(remainder);
    if (code) {
      const inner = code[1];
      append(inner, sourceOffset + cursor + 1);
      cursor += code[0].length;
      continue;
    }

    const marker = /^(\*\*|__|~~|\*|_)/u.exec(remainder)?.[0];
    if (marker) {
      let closing = source.indexOf(marker, cursor + marker.length);
      let closingLength = marker.length;
      if (marker === "**" || marker === "__") {
        const nestedTriple = source.indexOf(marker[0].repeat(3), cursor + marker.length);
        if (nestedTriple >= 0 && (closing < 0 || nestedTriple <= closing)) {
          closing = nestedTriple + 1;
          closingLength = 2;
        }
      }
      if (closing > cursor + marker.length) {
        const style: EmphasisStyle = marker === "~~" ? "strikethrough" : marker.length === 2 ? "strong" : "emphasis";
        const innerStart = cursor + marker.length;
        const inner = source.slice(innerStart, closing);
        for (const run of parseInline(inner, sourceOffset + innerStart, [...inherited, style])) {
          append(run.text, run.sourceStart, run.emphasisStyles);
        }
        cursor = closing + closingLength;
        continue;
      }
    }

    append(source[cursor], sourceOffset + cursor);
    cursor += 1;
  }

  return runs;
}

function wordCandidates(visibleText: string): TokenCandidate[] {
  const result: TokenCandidate[] = [];
  for (const match of visibleText.matchAll(/\S+/gu)) {
    const text = match[0];
    const start = match.index ?? 0;
    result.push({ text, start, end: start + text.length });
  }
  return result;
}

function getRunRanges(runs: InlineRun[]): Array<InlineRun & { visibleStart: number; visibleEnd: number }> {
  let visibleOffset = 0;
  return runs.map((run) => {
    const visibleStart = visibleOffset;
    visibleOffset += run.text.length;
    return { ...run, visibleStart, visibleEnd: visibleOffset };
  });
}

function sourceEndForVisibleOffset(
  runs: Array<InlineRun & { visibleStart: number; visibleEnd: number }>,
  visibleOffset: number,
): number {
  const run = runs.find((candidate) => visibleOffset > candidate.visibleStart && visibleOffset <= candidate.visibleEnd);
  return run ? run.sourceStart + visibleOffset - run.visibleStart : 0;
}

function sourceOffsetForVisibleOffset(
  runs: Array<InlineRun & { visibleStart: number; visibleEnd: number }>,
  visibleOffset: number,
): number {
  const run = runs.find((candidate) => visibleOffset >= candidate.visibleStart && visibleOffset < candidate.visibleEnd);
  return run ? run.sourceStart + visibleOffset - run.visibleStart : 0;
}

function isOpeningPunctuation(text: string): boolean {
  return /^[¿¡([{“«]+$/u.test(text);
}

function isClosingPunctuation(text: string): boolean {
  return /^[,.;:!?…)}\]”’"'»]+$/u.test(text);
}

function punctuationAfter(word: string): MarkdownToken["punctuation"] {
  if (/[.!?…][”’"')\]»}]*$/u.test(word)) return "sentence";
  if (/;[”’"')\]»}]*$/u.test(word)) return "semicolon";
  if (/:+[”’"')\]»}]*$/u.test(word)) return "colon";
  if (/[,”’"')\]»}]+$/u.test(word)) return "comma";
  return null;
}

function sameStyles(first: EmphasisStyle[], second: EmphasisStyle[]): boolean {
  return first.length === second.length && first.every((style, index) => style === second[index]);
}
