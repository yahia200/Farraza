import * as React from "react"

/*
 * True when the primary input is a precise, hover-capable pointer (mouse,
 * trackpad). The pipeline board enables drag-and-drop only then: pragmatic-
 * drag-and-drop is built on the browser's native HTML5 drag events, which
 * are unreliable on touch screens and fight with scrolling.
 * https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer
 *
 * Same shape as use-mobile.ts (useSyncExternalStore over matchMedia).
 */
const QUERY = "(hover: hover) and (pointer: fine)"

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useFinePointer() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // No pointer on the server: render without drag, enable it once hydrated.
    () => false
  )
}
