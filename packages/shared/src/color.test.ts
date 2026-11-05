import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, isHexColor, startingColorFor } from './color.js';

/*
 * The brand color picker's math: HSV on screen, `#rrggbb` in the database.
 */

describe('hsvToHex', () => {
  it('maps the primary and secondary hues', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 60, s: 1, v: 1 })).toBe('#ffff00');
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00');
    expect(hsvToHex({ h: 180, s: 1, v: 1 })).toBe('#00ffff');
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe('#0000ff');
    expect(hsvToHex({ h: 300, s: 1, v: 1 })).toBe('#ff00ff');
  });

  it('gives white, black and greys when there is no saturation', () => {
    expect(hsvToHex({ h: 200, s: 0, v: 1 })).toBe('#ffffff');
    expect(hsvToHex({ h: 200, s: 0.5, v: 0 })).toBe('#000000');
    expect(hsvToHex({ h: 90, s: 0, v: 0.5 })).toBe('#808080');
  });

  it('wraps the hue around and clamps saturation and value', () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: -120, s: 1, v: 1 })).toBe('#0000ff');
    expect(hsvToHex({ h: 0, s: 3, v: 2 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: -1, v: -1 })).toBe('#000000');
  });
});

describe('hexToHsv', () => {
  it('reads a saturated color', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#0000ff')).toEqual({ h: 240, s: 1, v: 1 });
  });

  it('keeps the fallback hue for greys, white and black', () => {
    expect(hexToHsv('#808080', 123).h).toBe(123);
    expect(hexToHsv('#ffffff', 123)).toEqual({ h: 123, s: 0, v: 1 });
    expect(hexToHsv('#000000', 123)).toEqual({ h: 123, s: 0, v: 0 });
  });

  it('round-trips every kind of color back to the same hex', () => {
    const samples = ['#1a73e8', '#e8710a', '#0f9d58', '#fefefe', '#010203', '#ab12cd'];
    for (const hex of samples) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
    // A sweep across every channel combination in steps, so no sector is missed.
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
          expect(hsvToHex(hexToHsv(hex))).toBe(hex);
        }
      }
    }
  });
});

describe('isHexColor', () => {
  it('accepts only # and six hex digits, like the database CHECK', () => {
    expect(isHexColor('#1a73e8')).toBe(true);
    expect(isHexColor('#1A73E8')).toBe(true);
    expect(isHexColor('1a73e8')).toBe(false);
    expect(isHexColor('#1a73e')).toBe(false);
    expect(isHexColor('#1a73e8f')).toBe(false);
    expect(isHexColor('#gggggg')).toBe(false);
    expect(isHexColor('')).toBe(false);
  });

  it('refuses values that are not text at all', () => {
    expect(isHexColor(null)).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
    expect(isHexColor(0x1a73e8)).toBe(false);
  });
});

describe('startingColorFor', () => {
  it('returns a valid, repeatable color for a name', () => {
    const first = startingColorFor('Acme Hiring');
    expect(startingColorFor('Acme Hiring')).toEqual(first);
    expect(first.h).toBeGreaterThanOrEqual(0);
    expect(first.h).toBeLessThan(360);
    expect(first.s).toBeGreaterThan(0);
    expect(first.v).toBeGreaterThan(0);
  });

  it('still gives a usable color for an empty or whitespace name', () => {
    for (const name of ['', '   ']) {
      const color = startingColorFor(name);
      expect(color.h).toBeGreaterThanOrEqual(0);
      expect(color.h).toBeLessThan(360);
      expect(color.s).toBeGreaterThan(0);
      expect(color.v).toBeGreaterThan(0);
    }
  });
});
