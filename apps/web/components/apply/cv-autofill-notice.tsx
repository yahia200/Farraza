"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SparklesIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * The one "Filled from your CV" notice on the CV step, with Undo (spec `.scratch/cv-autofill/spec.md`,
 * "Web"). Shown while some form values are still untouched suggestions; `count` is how many.
 * Undo clears those only (the caller's `useCvAutofill().undo`). It is a polite status, not an alert:
 * nothing went wrong.
 *
 * Motion copies the screening-rule cards: Animate UI's panel timings, in 300 ms and out 150 ms with
 * a 12 px shift (`node_modules/@animate-ui/react/dist/utils/motion/index.js`), none under
 * `useReducedMotion()`.
 */
export function CvAutofillNotice({ count, onUndo }: { count: number; onUndo: () => void }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.div
          key="cv-autofill-notice"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: reduce ? 0 : 0.3, ease: [0.23, 1, 0.32, 1] as const },
          }}
          exit={{
            opacity: 0,
            y: reduce ? 0 : -12,
            transition: { duration: reduce ? 0 : 0.15, ease: [0.4, 0, 1, 1] as const },
          }}
        >
          <Alert role="status" className="mt-3">
            <SparklesIcon />
            <AlertTitle>Filled from your CV</AlertTitle>
            <AlertDescription>
              We filled in what we could find. Check it on the next steps and change anything that&apos;s wrong.
            </AlertDescription>
            <AlertAction>
              <Button type="button" variant="outline" size="sm" onClick={onUndo}>
                Undo
              </Button>
            </AlertAction>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
