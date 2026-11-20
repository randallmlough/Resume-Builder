export interface RichMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: RichMark[];
  text?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, '&#39;');
}

function inlineMarkdownToHtml(text: string): string {
  const tokenRegex =
    /(`[^`]+`)|(\[([^\]]+)\]\(([^)]+)\))|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(_([^_]+)_)/g;

  let out = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out += escapeHtml(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      out += `<code>${escapeHtml(match[1].slice(1, -1))}</code>`;
    } else if (match[2]) {
      const labelHtml = inlineMarkdownToHtml(match[3]);
      const href = escapeAttr(match[4].trim());
      out += `<a href="${href}">${labelHtml}</a>`;
    } else if (match[5]) {
      out += `<strong><em>${inlineMarkdownToHtml(match[6])}</em></strong>`;
    } else if (match[7] || match[9]) {
      const inner = match[8] ?? match[10];
      out += `<strong>${inlineMarkdownToHtml(inner)}</strong>`;
    } else if (match[11] || match[13]) {
      const inner = match[12] ?? match[14];
      out += `<em>${inlineMarkdownToHtml(inner)}</em>`;
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    out += escapeHtml(text.slice(lastIndex));
  }

  return out;
}

/**
 * Converts stored cover-letter Markdown into clean semantic HTML for Tiptap.
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let paragraphLines: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const joined = paragraphLines
      .map((line, idx) => {
        const hasHardBreak = line.endsWith('  ') && idx < paragraphLines.length - 1;
        const body = inlineMarkdownToHtml(line.trim());
        return hasHardBreak ? `${body}<br>` : body;
      })
      .join(' ')
      .replace(/<br> /g, '<br>');
    html.push(`<p>${joined}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const itemsHtml = listItems.map((item) => `<li><p>${inlineMarkdownToHtml(item)}</p></li>`).join('');
    html.push(`<${listType}>${itemsHtml}</${listType}>`);
    listType = null;
    listItems = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      html.push('<hr>');
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${inlineMarkdownToHtml(headingMatch[2])}</h${level}>`);
      continue;
    }

    const ulMatch = rawLine.match(/^\s*[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }

    const olMatch = rawLine.match(/^\s*\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      continue;
    }

    flushList();
    paragraphLines.push(rawLine);
  }

  flushParagraph();
  flushList();

  return html.length > 0 ? html.join('') : '<p></p>';
}

function serializeInlineNodes(nodes: RichNode[] | undefined): string {
  if (!nodes || nodes.length === 0) return '';

  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') {
        return '  \n';
      }
      if (node.type !== 'text') {
        return serializeInlineNodes(node.content);
      }

      const rawText = node.text ?? '';
      if (!rawText) return '';

      const marks = node.marks ?? [];
      if (marks.length === 0) return rawText;

      // Preserve leading/trailing whitespace outside emphasis delimiters for valid Markdown
      const leadMatch = rawText.match(/^(\s*)/);
      const trailMatch = rawText.match(/(\s*)$/);
      const lead = leadMatch ? leadMatch[1] : '';
      const trail = trailMatch ? trailMatch[1] : '';
      let core = rawText.slice(lead.length, rawText.length - trail.length);

      if (!core) return rawText;

      const hasCode = marks.some((m) => m.type === 'code');
      const hasBold = marks.some((m) => m.type === 'bold');
      const hasItalic = marks.some((m) => m.type === 'italic');
      const linkMark = marks.find((m) => m.type === 'link');

      if (hasCode) {
        core = `\`${core}\``;
      }
      if (hasBold && hasItalic) {
        core = `***${core}***`;
      } else if (hasBold) {
        core = `**${core}**`;
      } else if (hasItalic) {
        core = `*${core}*`;
      }
      if (linkMark && typeof linkMark.attrs?.href === 'string' && linkMark.attrs.href.trim()) {
        core = `[${core}](${linkMark.attrs.href.trim()})`;
      }

      return `${lead}${core}${trail}`;
    })
    .join('');
}

function serializeListItem(item: RichNode, prefix: string, indent: string): string {
  const children = item.content ?? [];
  const lines: string[] = [];

  children.forEach((child, idx) => {
    if (child.type === 'paragraph') {
      const text = serializeInlineNodes(child.content);
      if (idx === 0) {
        lines.push(`${indent}${prefix}${text}`);
      } else {
        lines.push(`${indent}  ${text}`);
      }
    } else if (child.type === 'bulletList' || child.type === 'orderedList') {
      const nested = serializeBlockNode(child, `${indent}  `);
      if (nested) lines.push(nested);
    } else {
      const text = serializeInlineNodes(child.content);
      if (text) lines.push(`${indent}${idx === 0 ? prefix : '  '}${text}`);
    }
  });

  return lines.join('\n');
}

function serializeBlockNode(node: RichNode, indent = ''): string {
  switch (node.type) {
    case 'paragraph':
      return serializeInlineNodes(node.content);

    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)));
      return `${'#'.repeat(level)} ${serializeInlineNodes(node.content)}`;
    }

    case 'bulletList':
      return (node.content ?? [])
        .map((item) => serializeListItem(item, '- ', indent))
        .join('\n');

    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((item, idx) => serializeListItem(item, `${start + idx}. `, indent))
        .join('\n');
    }

    case 'horizontalRule':
      return '---';

    default:
      return serializeInlineNodes(node.content);
  }
}

/**
 * Serializes a Tiptap/ProseMirror JSON document back into clean Markdown.
 */
export function tiptapJsonToMarkdown(doc: RichNode): string {
  const blocks = (doc.content ?? []).map((node) => serializeBlockNode(node));
  // Drop trailing empty paragraphs while preserving intentional inner spacing
  while (blocks.length > 0 && blocks[blocks.length - 1].trim() === '') {
    blocks.pop();
  }
  return blocks.join('\n\n').trim();
}
