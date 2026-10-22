'use client';

import { useSyncExternalStore } from 'react';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/**
 * True only after hydration. useSyncExternalStore returns the server snapshot
 * (false) during SSR and the hydrating render, then the client snapshot (true),
 * so it flips to true without ever calling setState in an effect — which this
 * repo's react-hooks/set-state-in-effect rule forbids (see hooks/use-mobile.ts).
 */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** The three choices next-themes understands with enableSystem + defaultTheme="system". */
const MODES = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
] as const;

/**
 * A segmented control (Base UI ToggleGroup) for the color theme, backed by
 * next-themes' useTheme().
 *
 * Base UI's ToggleGroup is array-valued (docs/react/components/toggle-group.md):
 * `value` is `string[]` and `onValueChange` hands back the full pressed set,
 * with no single-select mode in @base-ui/react 1.8. So the active theme is
 * passed as a one-item array, and the change handler has to collapse the set
 * back to a single theme (see TODO(human) below).
 */
export function AppearanceMode() {
  const { theme, setTheme } = useTheme();

  // next-themes resolves the stored/system theme only on the client, so the
  // server renders with `theme` undefined. Rendering the control before mount
  // would select nothing on the server and mismatch the client's first paint,
  // so we wait for mount and show a placeholder meanwhile (next-themes README,
  // "Avoid Hydration Mismatch").
  const mounted = useMounted();

  if (!mounted) {
    return <Skeleton className="h-9 w-72" />;
  }

  // TODO(human): turn the new pressed set into a single setTheme(...) call.
  // `next` is every value currently pressed in the group. Decide what the
  // theme should become and call setTheme, keeping these in mind:
  //   - this is a single-choice control: exactly one theme should end up set;
  //   - `next` can contain the value that was just added alongside the old one;
  //   - clicking the active item can leave `next` empty — a user shouldn't be
  //     able to end up with no theme selected.
  function handleValueChange(next: string[]) {
    const newTheme = next.find((value) => value !== theme);
    if (newTheme) {
      setTheme(newTheme);
    }
  }

  return (
    <ToggleGroup
      value={theme ? [theme] : []}
      onValueChange={handleValueChange}
      variant="outline"
      spacing={0}
      aria-label="Color theme"
    >
      {MODES.map((mode) => (
        <ToggleGroupItem key={mode.value} value={mode.value} aria-label={mode.label} className="gap-2">
          <mode.icon />
          {mode.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
