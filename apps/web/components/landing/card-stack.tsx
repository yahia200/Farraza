'use client';

import { createContext, use, useMemo, useRef, type ReactNode } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react';

import { COVERED_SCALE_STEP, PEEK, PIN_TOP, cardHeight } from '@/components/landing/card-layout';

type CardStackValue = {
  /** How far the list has scrolled: 0 when its top reaches the top of the viewport, 1 when its bottom reaches the bottom. */
  progress: MotionValue<number>;
  total: number;
};

const CardStackContext = createContext<CardStackValue | null>(null);

function useCardStack(): CardStackValue {
  const stack = use(CardStackContext);
  if (!stack) {
    throw new Error('StackCard must be rendered inside a CardStack.');
  }
  return stack;
}

/**
 * A list of cards that pile up as you scroll: each card pins a little lower
 * than the one before, and the next one slides up over it. The pinning is
 * plain CSS `position: sticky`; this component only tracks the list's scroll
 * progress (motion's `useScroll`) so covered cards can shrink.
 *
 * Sticky stops working inside an ancestor that sets `overflow` (hidden, auto
 * or scroll), so keep the stack out of such containers.
 *
 * The cards' content is passed in as children, so it can stay server-rendered
 * ("Interleaving Server and Client Components" and "Context providers" in
 * next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md).
 */
export function CardStack({
  total,
  className,
  children,
}: {
  total: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const value = useMemo(() => ({ progress: scrollYProgress, total }), [scrollYProgress, total]);

  // role="list": Tailwind's reset removes the list markers, and Safari then
  // stops announcing the element as a list.
  return (
    <CardStackContext value={value}>
      <ol ref={ref} role="list" className={className}>
        {children}
      </ol>
    </CardStackContext>
  );
}

/**
 * The scale of card `index` as the list scrolls: 1 while it is the top card,
 * shrinking a little as later cards cover it.
 */
function useCoveredScale(progress: MotionValue<number>, index: number, total: number) {
  // Starts shrinking about when it pins (the next card begins sliding over it)
  // and loses COVERED_SCALE_STEP for each card that ends up on top of it, so the
  // last stays at 1. It reaches its size at (total - 1) / total of the list's scroll, a little
  // before the last card lands, because the space after the last card is part
  // of what useScroll measures. For the last card the range is empty, but its
  // output is 1 to 1, which interpolate() returns as a constant
  // (motion-dom/dist/es/utils/interpolate.mjs, the `output[0] === output[1]` check).
  return useTransform(progress, [index / total, (total - 1) / total], [1, 1 - (total - 1 - index) * COVERED_SCALE_STEP]);
}

/**
 * One card of a CardStack. `index` is its position in the list, from 0. Every
 * card has the same height: as tall as `MAX_CARD_HEIGHT`, but short enough
 * that the last card, which pins lowest, still fits on the screen.
 */
export function StackCard({ index, children }: { index: number; children: ReactNode }) {
  const { progress, total } = useCardStack();
  const scale = useCoveredScale(progress, index, total);
  // useReducedMotion reads the setting once into state
  // (framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs); with
  // reduced motion the cards still stack, they just don't shrink.
  const reduceMotion = useReducedMotion();
  const height = cardHeight(total);

  return (
    <li className="sticky" style={{ top: `calc(${PIN_TOP} + ${index} * ${PEEK})` }}>
      <motion.div style={{ height, scale: reduceMotion ? 1 : scale, transformOrigin: 'top' }}>
        {children}
      </motion.div>
    </li>
  );
}
