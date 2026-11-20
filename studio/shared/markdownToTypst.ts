/**
 * Converts Markdown (used for cover letter body) to clean Typst markup.
 * Supports headings (#, ##, ###), bold (**text**), italic (*text* / _text_),
 * inline code (`code`), links ([label](url)), unordered/ordered lists,
 * and thematic breaks (---).
 */

export function escapeTypstText(text: string): string {
  return text.replace(/([\\#*_`$<>\[\]@~])/g, '\\$1');
}

function escapeTypstString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function convertInline(text: string): string {
  // Tokenize inline markdown constructs cleanly without nested regex corruption
  const tokenRegex =
    /(`[^`]+`)|(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(_([^_]+)_)/g;

  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result += escapeTypstText(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Inline code
      const code = match[1].slice(1, -1);
      result += `#raw("${escapeTypstString(code)}")`;
    } else if (match[2]) {
      // Link
      const label = convertInline(match[3]);
      const dest = escapeTypstString(match[4].trim());
      result += `#link("${dest}")[${label}]`;
    } else if (match[5] || match[7]) {
      // Bold
      const inner = match[6] ?? match[8];
      result += `#strong[${convertInline(inner)}]`;
    } else if (match[9] || match[11]) {
      // Italic
      const inner = match[10] ?? match[12];
      result += `#emph[${convertInline(inner)}]`;
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    result += escapeTypstText(text.slice(lastIndex));
  }

  return result;
}

export function markdownToTypst(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const joined = paragraphBuffer.map((l) => convertInline(l.trim())).join(' ');
      out.push(joined);
      out.push('');
      paragraphBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed === '') {
      flushParagraph();
      continue;
    }

    // Thematic break
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      out.push('#v(4pt)#line(length: 100%, stroke: 0.4pt + luma(160))#v(4pt)');
      out.push('');
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      const sizes = ['12pt', '11pt', '10.5pt', '10pt'];
      const size = sizes[level - 1] ?? '10pt';
      out.push(`#block(sticky: true, below: 6pt)[#text(size: ${size}, weight: "bold")[${convertInline(headingMatch[2])}]]`);
      out.push('');
      continue;
    }

    // Unordered list item (preserve nesting by 2-space indents)
    const ulMatch = rawLine.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      const indent = ' '.repeat(ulMatch[1].length);
      out.push(`${indent}- ${convertInline(ulMatch[2])}`);
      continue;
    }

    // Ordered list item
    const olMatch = rawLine.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      const indent = ' '.repeat(olMatch[1].length);
      out.push(`${indent}+ ${convertInline(olMatch[2])}`);
      continue;
    }

    // Hard line break with trailing two spaces
    if (rawLine.endsWith('  ')) {
      paragraphBuffer.push(rawLine.trimEnd() + ' \\');
    } else {
      paragraphBuffer.push(rawLine);
    }
  }

  flushParagraph();
  return out.join('\n').trim();
}
