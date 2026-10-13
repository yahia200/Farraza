import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/*
 * Changed from the shadcn-generated version, which called setState inside an
 * effect (flagged by react-hooks/set-state-in-effect). useSyncExternalStore
 * is React's recommended way to subscribe to a browser API:
 * https://react.dev/reference/react/useSyncExternalStore#subscribing-to-a-browser-api
 */
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // On the server there is no viewport: assume desktop, as the original did.
    () => false
  )
}
