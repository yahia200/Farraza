/**
 * Color math for the brand color picker. The picker works in HSV (hue 0-360, saturation and
 * value 0-1: the saturation/brightness square plus a hue strip), the database stores `#rrggbb`.
 * Pure, so the web app (which has no test runner) gets its tests here.
 */
export type Hsv = { h: number; s: number; v: number };

// Same rule as the companies_brand_color_format CHECK in contract.prisma.
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Takes `unknown` because the picker's hex box and form values are not guaranteed to be strings. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** `#rrggbb` (lower case) for a color. Hue wraps around, saturation and value are clamped. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clampNumber(s, 0, 1);
  const value = clampNumber(v, 0, 1);

  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - chroma;

  // The six 60-degree sectors of the hue circle; a switch (not an indexed array) so each channel stays a number.
  let rgb: [number, number, number];
  switch (Math.floor(hue / 60)) {
    case 0:
      rgb = [chroma, x, 0];
      break;
    case 1:
      rgb = [x, chroma, 0];
      break;
    case 2:
      rgb = [0, chroma, x];
      break;
    case 3:
      rgb = [0, x, chroma];
      break;
    case 4:
      rgb = [x, 0, chroma];
      break;
    default:
      rgb = [chroma, 0, x];
  }

  return `#${rgb.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The HSV of a `#rrggbb` color. A grey (and black and white) has no hue of its own, so it comes
 * back with `fallbackHue`: the picker passes the hue it is already showing, so dragging the circle
 * to the grey edge doesn't throw the hue strip back to red.
 */
export function hexToHsv(hex: string, fallbackHue = 0): Hsv {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  const s = max === 0 ? 0 : delta / max;

  if (delta === 0) return { h: fallbackHue, s, v: max };

  const sector = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (sector * 60 + 360) % 360, s, v: max };
}

/**
 * The color the picker's circle starts on for a company with no brand color yet, so the first
 * thing the manager sees is a pleasant, vivid color instead of white.
 * Must be repeatable (same name, same color), give `h` in [0, 360), and never be grey
 * (`s` and `v` above 0), even for an empty or whitespace name. See `color.test.ts`.
 */
export function startingColorFor(companyName: string): Hsv {
  // FNV-1a over the trimmed name: tiny, deterministic, and spreads similar names
  // (Acme / Acme2) across the hue wheel. `Math.imul` keeps the product in 32 bits.
  let hash = 0x811c9dc5;
  for (const char of companyName.trim()) {
    hash = Math.imul(hash ^ char.codePointAt(0)!, 0x01000193) >>> 0;
  }
  // Fixed saturation and brightness keep every start vivid but not neon, so only
  // the hue varies. An empty name hashes to the offset basis, still a valid hue.
  return { h: hash % 360, s: 0.65, v: 0.85 };
}
