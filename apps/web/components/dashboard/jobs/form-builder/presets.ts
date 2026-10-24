import { GraduationCapIcon, type LucideIcon } from 'lucide-react';
import type { FormField, LeafFormField, PresetKey } from '@repo/shared';
import { newOption } from './field-types';

/**
 * A Preset: a ready-made question (for now always a repeating group) that the "Add question" menu
 * inserts as a copy (ADR-0004). The shared package only holds the catalog of Preset keys; the
 * definitions (labels, help text, limits, options, defaults) live here, next to `newField`.
 *
 * `build()` makes a new copy each time: the group, every sub-question and every option get fresh
 * ids, and every question carries its Preset key. The form keeps no link back to this definition,
 * so changing it later never changes a form that already has the Preset.
 */
export interface Preset {
  /** The group's Preset key; the menu greys the Preset out while a question on the form has it. */
  presetKey: PresetKey;
  /** The menu item's text. */
  menuLabel: string;
  icon: LucideIcon;
  build: () => FormField;
}

/** Every key is a UUID made in the browser, like a hand-built question's. */
const leafBase = (presetKey: PresetKey, label: string, required: boolean, helpText: string | null = null) => ({
  key: crypto.randomUUID(),
  presetKey,
  label,
  helpText,
  required,
});

function shortText(presetKey: PresetKey, label: string, maxLength: number, required: boolean, helpText?: string): LeafFormField {
  return { ...leafBase(presetKey, label, required, helpText), type: 'short_text', config: { maxLength } };
}

const DEGREES = ['High school', 'Diploma', "Bachelor's", "Master's", 'Doctorate', 'Other'];

const education: Preset = {
  presetKey: 'education',
  menuLabel: 'Education',
  icon: GraduationCapIcon,
  build: () => ({
    ...leafBase('education', 'Education', false),
    type: 'repeating_group',
    config: {
      maxEntries: 5,
      fields: [
        shortText('education.school', 'School', 150, true),
        {
          ...leafBase('education.degree', 'Degree', true),
          type: 'single_select',
          config: { options: DEGREES.map(newOption), rejectOptionIds: [] },
        },
        shortText('education.field_of_study', 'Field of study', 150, false),
        shortText('education.start_year', 'Start year', 30, false),
        shortText('education.end_year', 'End year', 30, false, 'An expected year is fine if you have not finished yet.'),
      ],
    },
  }),
};

/** The Presets the "Add question" menu offers, in menu order. */
export const PRESETS: Preset[] = [education];
