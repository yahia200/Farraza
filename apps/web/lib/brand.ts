import 'server-only';

/**
 * Black or white, whichever reads better on `brandColor` as a background.
 * Uses the WCAG relative-luminance contrast ratio (the same math the contrast
 * checkers use), so text on a company's brand color stays legible whatever the
 * color is. Falls back to white when there's no brand color (the default
 * `bg-muted/30` surface, which is light).
 *
 * WCAG 2.1 relative luminance and contrast ratio:
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance and
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function getReadableTextColor(brandColor: string | null): string {
  if (!brandColor) return '#ffffff';

  const red = Number.parseInt(brandColor.slice(1, 3), 16) / 255;
  const green = Number.parseInt(brandColor.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(brandColor.slice(5, 7), 16) / 255;
  const linearize = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;

  return whiteContrast >= blackContrast ? '#ffffff' : '#000000';
}
