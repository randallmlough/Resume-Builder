import { describe, expect, it } from 'vitest';
import { markdownToTypst } from './markdownToTypst.js';

describe('markdownToTypst', () => {
  it('converts headings, bold, italic, code, links, lists, and escapes specials', () => {
    const md = `# Intro

Hello **world** with *emphasis*, \`code\`, and [site](https://example.com).
Special chars: 100% & $50 #tag.

- First item
- Second **bold** item

1. Step one
2. Step two

---`;

    const out = markdownToTypst(md);
    expect(out).toContain('#text(size: 12pt, weight: "bold")[Intro]');
    expect(out).toContain('#strong[world]');
    expect(out).toContain('#emph[emphasis]');
    expect(out).toContain('#raw("code")');
    expect(out).toContain('#link("https://example.com")[site]');
    expect(out).toContain('\\$50 \\#tag');
    expect(out).toContain('- First item');
    expect(out).toContain('- Second #strong[bold] item');
    expect(out).toContain('+ Step one');
    expect(out).toContain('#line(length: 100%');
  });
});
