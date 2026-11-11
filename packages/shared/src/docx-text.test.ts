import { describe, expect, it } from 'vitest';
import { DOCX_PART_TEXT_CAP, docxPartText, isDocxHeaderOrFooter } from './docx-text.js';

// The XML below is invented; it has the shape of word/footer1.xml.

const footer = `<?xml version="1.0" encoding="UTF-8"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t>jessicahue@email.com</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">T:  </w:t></w:r><w:r><w:t>(551) 123-7676</w:t></w:r></w:p>
  <w:p><w:pPr/></w:p>
  <w:p><w:r><w:t>Fish &amp; Chips &lt;3</w:t></w:r></w:p>
</w:ftr>`;

describe('isDocxHeaderOrFooter', () => {
  it('accepts the header and footer parts of a DOCX, numbered or not', () => {
    for (const name of ['word/header1.xml', 'word/footer2.xml', 'word/footer.xml', 'word/header12.xml']) {
      expect(isDocxHeaderOrFooter(name)).toBe(true);
    }
  });

  it('refuses the body, the relationships, media and anything nested', () => {
    for (const name of [
      'word/document.xml',
      'word/_rels/footer1.xml.rels',
      'word/media/footer1.xml',
      'word/footer1.xml.rels',
      'footer1.xml',
      '../word/footer1.xml',
    ]) {
      expect(isDocxHeaderOrFooter(name)).toBe(false);
    }
  });
});

describe('docxPartText', () => {
  it('gives one line per paragraph and joins the runs of a paragraph', () => {
    expect(docxPartText(footer)).toBe('jessicahue@email.com\nT:  (551) 123-7676\nFish & Chips <3');
  });

  it('drops empty paragraphs and returns an empty string for XML with no text', () => {
    expect(docxPartText('<w:ftr><w:p/><w:p><w:pPr/></w:p></w:ftr>')).toBe('');
    expect(docxPartText('')).toBe('');
  });

  it('does not decode an entity twice', () => {
    expect(docxPartText('<w:p><w:r><w:t>&amp;lt;</w:t></w:r></w:p>')).toBe('&lt;');
  });

  it('ignores text-looking content outside a w:t element', () => {
    expect(docxPartText('<w:p><w:instrText>PAGE</w:instrText><w:r><w:t>Page</w:t></w:r></w:p>')).toBe('Page');
  });

  it('stops at the cap, so a hostile part cannot grow the CV text without bound', () => {
    const huge = `<w:p><w:r><w:t>${'a'.repeat(DOCX_PART_TEXT_CAP * 3)}</w:t></w:r></w:p>`;
    expect(docxPartText(huge)).toHaveLength(DOCX_PART_TEXT_CAP);
  });
});
