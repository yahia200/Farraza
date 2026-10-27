// Sizes of the landing's card stack (card-stack.tsx). A plain module, so a
// server component or another variant can use them too (a client module's
// non-component exports don't reach server components).

/** Where the top card pins: clear of the floating NavBar. */
export const PIN_TOP = '17svh';
/** How far apart the cards sit, so the ones behind peek out. */
export const PEEK = '1.25rem';
/** The tallest a card gets on a tall screen. */
export const MAX_CARD_HEIGHT = '43rem';
/** Space kept under the lowest card. */
export const BOTTOM_GAP = '1rem';
/** How much narrower a card gets for each card in front of it. */
export const COVERED_SCALE_STEP = 0.0125;

/**
 * The height of every card: as tall as `MAX_CARD_HEIGHT`, but short enough
 * that the lowest card, `total - 1` peeks below the top one, still fits on
 * the screen.
 */
export function cardHeight(total: number): string {
  return `min(${MAX_CARD_HEIGHT}, calc(100svh - ${PIN_TOP} - ${total - 1} * ${PEEK} - ${BOTTOM_GAP}))`;
}
