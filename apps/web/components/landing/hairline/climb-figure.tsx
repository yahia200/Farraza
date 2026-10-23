'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import HL from './kernel.js';
import { climb } from './climb.js';

/**
 * The figure's colours, each any CSS colour. They set the kernel's own
 * --hairline-* variables (see `css()` in kernel.js); anything left out keeps
 * the kernel's light palette. The box around the drawing stays transparent:
 * give it a background with a class on `className`.
 */
export type HairlinePalette = {
  /**
   * The fill of every solid. Keep it opaque: a nearer solid hides the ones
   * behind it with its fill. The same colour as the surface behind the figure
   * makes the drawing read as lines; any other makes filled shapes.
   */
  plate?: string;
  /** The bright stroke: the one highlight (the picked step, or the landing at rest). */
  hi?: string;
  /** Silhouettes: the outline of every solid. */
  edge?: string;
  /** Lines with no class of their own. */
  mid?: string;
  /** Creases and other inner lines. */
  lo?: string;
  /** In screen pixels (the kernel's strokes don't scale with the drawing). The kernel's default is 0.9. */
  strokeWidth?: number;
};

/** The palette as the CSS variables the kernel reads. React drops the undefined ones. */
function paletteStyle({ plate, hi, edge, mid, lo, strokeWidth }: HairlinePalette): CSSProperties {
  return {
    '--hairline-plate': plate,
    '--hairline-hi': hi,
    '--hairline-edge': edge,
    '--hairline-mid': mid,
    '--hairline-lo': lo,
    '--hairline-stroke': strokeWidth,
  } as CSSProperties;
}

/**
 * The Climb figure (a Hairline drawing, see climb.js), mounted the way
 * @lucasmarkes/hairline's React components mount theirs: an empty box on the
 * server, drawn in an effect. It plays its tour until a pointer arrives; the
 * kernel's frame loop sleeps while the box is offscreen, and the figure rests
 * under prefers-reduced-motion.
 */
export function ClimbFigure({
  label,
  palette = {},
  className,
}: {
  label: string;
  palette?: HairlinePalette;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    HL.inject(document);
    const svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage);
    // The figure writes the stage under the pointer to its read-out. The page
    // doesn't show it, so it lands on a plain object and goes nowhere.
    const read = { textContent: '' };
    const figure = climb.mount({ stage, svg, read }, climb.range[1]);
    const tour = HL.tour(stage, climb.tour);
    return () => {
      tour.stop();
      figure.destroy();
      svg.remove();
    };
  }, []);

  // The wrapper carries the palette (the stage inherits the variables) and any
  // padding: the kernel's svg fills the stage's padding box.
  return (
    <div className={className} style={paletteStyle(palette)}>
      {/* data-hairline-theme pins the light palette under the overrides: the
          marketing pages are always light, but the kernel's CSS would follow
          an html.dark. */}
      <div
        ref={stageRef}
        data-hairline={climb.name}
        data-hairline-theme="light"
        role="img"
        aria-label={label}
      />
    </div>
  );
}
