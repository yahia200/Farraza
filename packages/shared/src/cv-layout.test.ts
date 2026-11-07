import { describe, expect, it } from 'vitest';
import { buildLayoutLines, isBoldFamily, type LayoutItem } from './cv-layout.js';

// All text below is invented. PDF space: origin bottom-left, so a larger y is higher on the page.

function item(str: string, x: number, y: number, extra: Partial<LayoutItem> = {}): LayoutItem {
  return { str, x, y, width: str.length * 5, fontSize: 10, fontFamily: 'sans-serif', ...extra };
}

describe('isBoldFamily', () => {
  it('matches real bold font names and not generic families', () => {
    expect(isBoldFamily('Calibri-Bold')).toBe(true);
    expect(isBoldFamily('Arial Black')).toBe(true);
    expect(isBoldFamily('Helvetica-Demi')).toBe(true);
    expect(isBoldFamily('sans-serif')).toBe(false);
    expect(isBoldFamily('')).toBe(false);
  });
});

describe('buildLayoutLines', () => {
  it('orders lines top to bottom and items left to right', () => {
    const lines = buildLayoutLines([
      item('Backend engineer', 0, 700),
      item('Hassan', 60, 760),
      item('Sara', 0, 760),
    ]);
    expect(lines.map((line) => line.text)).toEqual(['Sara Hassan', 'Backend engineer']);
  });

  it('keeps the biggest font size of the line and its bold flag', () => {
    const [name, role] = buildLayoutLines([
      item('Sara Hassan', 0, 760, { fontSize: 24, fontFamily: 'Calibri-Bold' }),
      item('Backend engineer', 0, 730),
    ]);
    expect(name).toEqual({ text: 'Sara Hassan', fontSize: 24, bold: true });
    expect(role).toEqual({ text: 'Backend engineer', fontSize: 10, bold: false });
  });

  it('is bold only when every item on the line is bold', () => {
    const [line] = buildLayoutLines([
      item('Sara', 0, 760, { fontFamily: 'Calibri-Bold' }),
      item('Hassan', 40, 760),
    ]);
    expect(line?.bold).toBe(false);
  });

  it('joins items that touch and spaces items that have a gap', () => {
    const [line] = buildLayoutLines([
      item('(123) 456', 0, 700),
      item('-', 45, 700), // starts exactly where the last item ends
      item('7890', 50, 700),
      item('Cairo', 120, 700), // a real gap before it
    ]);
    expect(line?.text).toBe('(123) 456-7890 Cairo');
  });

  it('treats a small baseline difference as the same line', () => {
    const lines = buildLayoutLines([item('Sara', 0, 760), item('Hassan', 30, 758)]);
    expect(lines.map((l) => l.text)).toEqual(['Sara Hassan']);
  });

  it('drops blank items and items with unusable numbers', () => {
    const lines = buildLayoutLines([
      item('   ', 0, 760),
      item('Bad', Number.NaN, 700),
      item('Zero size', 0, 650, { fontSize: 0 }),
      item('Kept', 0, 600),
    ]);
    expect(lines.map((l) => l.text)).toEqual(['Kept']);
  });

  it('gives no lines for no items', () => {
    expect(buildLayoutLines([])).toEqual([]);
  });
});
