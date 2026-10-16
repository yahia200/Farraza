'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { CvMode, FormFields } from '@repo/shared';

/**
 * A local copy of unsaved builder changes, in localStorage, in case the tab
 * closes, the power goes out or the network drops before "Save draft".
 *
 * Reading uses useSyncExternalStore: localStorage doesn't exist on the
 * server, so the server snapshot is "no backup" and React switches to the
 * real value right after hydration, without a mismatch
 * (https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering).
 * localStorage only fires "storage" events in *other* tabs, so this hook also
 * notifies its own listeners after writing.
 */

export interface FormBackup {
  savedAt: string;
  fields: FormFields;
  /** Missing in backups written before the CV setting existed; those mean "unchanged". */
  cvMode?: CvMode;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // Storage blocked (private mode, settings): no backup.
  }
}

export function useFormBackup({
  key,
  fields,
  cvMode,
  isDirty,
}: {
  key: string;
  fields: FormFields;
  cvMode: CvMode;
  isDirty: boolean;
}) {
  // The raw string is the snapshot: equal strings compare equal, so React
  // only re-renders when the stored backup actually changes.
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const backup = useMemo<FormBackup | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as FormBackup;
    } catch {
      return null;
    }
  }, [raw]);

  const write = useCallback(
    (value: FormBackup | null) => {
      try {
        if (value) localStorage.setItem(key, JSON.stringify(value));
        else localStorage.removeItem(key);
      } catch {
        // Storage full or blocked: the backup is best-effort.
      }
      notify();
    },
    [key],
  );

  // Keep the backup up to date while there are unsaved changes (debounced).
  // Writing to localStorage is syncing with an external system, which is what
  // Effects are for (https://react.dev/learn/synchronizing-with-effects).
  const editedRef = useRef(false);
  useEffect(() => {
    if (!isDirty) {
      // Back to the saved version after editing: the backup is no longer needed.
      if (editedRef.current) {
        editedRef.current = false;
        write(null);
      }
      return;
    }
    editedRef.current = true;
    const timer = window.setTimeout(() => write({ savedAt: new Date().toISOString(), fields, cvMode }), 500);
    return () => window.clearTimeout(timer);
  }, [fields, cvMode, isDirty, write]);

  return { backup, clear: useCallback(() => write(null), [write]) };
}
