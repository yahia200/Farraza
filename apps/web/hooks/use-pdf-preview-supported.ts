import * as React from "react"
import { useFinePointer } from "@/hooks/use-fine-pointer"

/*
 * True when this browser can show a PDF inside a page: the candidate sheet offers the PDF preview
 * only then, and otherwise the Download button is the way to read a CV.
 *
 * `navigator.pdfViewerEnabled` is the standard flag for "the browser has a built-in PDF viewer
 * that works in an <iframe>" (HTML spec, https://html.spec.whatwg.org/multipage/system-state.html#pdf-viewing-support;
 * typed in TypeScript's lib.dom.d.ts). It is false in Android Chrome. iPad and iPhone Safari say
 * true but show only the first page in a frame and can't scroll it, so touch-first devices are
 * left out as well, with the same "precise pointer" query the pipeline board uses for drag.
 *
 * Both are unknown on the server, so this is false until hydrated.
 */
const subscribeNever = () => () => {}

export function usePdfPreviewSupported() {
  const finePointer = useFinePointer()
  const hasViewer = React.useSyncExternalStore(
    subscribeNever,
    () => navigator.pdfViewerEnabled === true,
    () => false
  )
  return finePointer && hasViewer
}
