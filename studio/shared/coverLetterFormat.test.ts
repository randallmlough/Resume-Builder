import { describe, expect, it } from 'vitest';
import { markdownToHtml, tiptapJsonToMarkdown } from './coverLetterFormat.js';

describe('coverLetterFormat (Markdown <-> Tiptap)', () => {
  it('converts markdown headings, marks, links, lists, and rules into semantic HTML', () => {
    const md = `Dear Hiring Team,

I build **fast**, *reliable*, and ***accessible*** apps using \`TypeScript\` — see [my portfolio](https://example.com).

### Highlights

- **Speed**: 10ms live renders
- *Quality*: End-to-end tested

1. First step
2. Second step

---`;

    const html = markdownToHtml(md);
    expect(html).toContain('<p>Dear Hiring Team,</p>');
    expect(html).toContain('<strong>fast</strong>');
    expect(html).toContain('<em>reliable</em>');
    expect(html).toContain('<strong><em>accessible</em></strong>');
    expect(html).toContain('<code>TypeScript</code>');
    expect(html).toContain('<a href="https://example.com">my portfolio</a>');
    expect(html).toContain('<h3>Highlights</h3>');
    expect(html).toContain('<ul><li><p><strong>Speed</strong>: 10ms live renders</p></li>');
    expect(html).toContain('<ol><li><p>First step</p></li><li><p>Second step</p></li></ol>');
    expect(html).toContain('<hr>');
  });

  it('serializes Tiptap JSON back into clean Markdown', () => {
    const md = tiptapJsonToMarkdown({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Highlights' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Built with ' },
            { type: 'text', text: 'Typst', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            {
              type: 'text',
              text: 'React',
              marks: [{ type: 'italic' }, { type: 'link', attrs: { href: 'https://react.dev' } }],
            },
            { type: 'text', text: '.' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fast builds' }] }],
            },
          ],
        },
        { type: 'horizontalRule' },
      ],
    });

    expect(md).toBe(
      `### Highlights\n\nBuilt with **Typst** and [*React*](https://react.dev).\n\n- Fast builds\n\n---`
    );
  });
});
