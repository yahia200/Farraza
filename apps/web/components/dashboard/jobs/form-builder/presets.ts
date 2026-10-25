import { BriefcaseBusinessIcon, GraduationCapIcon, type LucideIcon } from 'lucide-react';
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

/** What a text sub-question needs: a single line unless `long`, and not required unless said so. */
interface TextSpec {
  label: string;
  maxLength: number;
  required?: boolean;
  helpText?: string;
  long?: boolean;
}

function text(presetKey: PresetKey, { label, maxLength, required = false, helpText, long = false }: TextSpec): LeafFormField {
  return { ...leafBase(presetKey, label, required, helpText), type: long ? 'long_text' : 'short_text', config: { maxLength } };
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
        text('education.school', { label: 'School', maxLength: 150, required: true }),
        {
          ...leafBase('education.degree', 'Degree', true),
          type: 'single_select',
          config: { options: DEGREES.map(newOption), rejectOptionIds: [] },
        },
        text('education.field_of_study', { label: 'Field of study', maxLength: 150 }),
        text('education.start_year', { label: 'Start year', maxLength: 30 }),
        text('education.end_year', {
          label: 'End year',
          maxLength: 30,
          helpText: 'An expected year is fine if you have not finished yet.',
        }),
      ],
    },
  }),
};

const experience: Preset = {
  presetKey: 'experience',
  menuLabel: 'Work experience',
  icon: BriefcaseBusinessIcon,
  build: () => ({
    ...leafBase('experience', 'Work experience', false),
    type: 'repeating_group',
    config: {
      maxEntries: 5,
      fields: [
        text('experience.job_title', { label: 'Job title', maxLength: 100, required: true }),
        text('experience.company', { label: 'Company', maxLength: 100, required: true }),
        text('experience.start_date', { label: 'Start date', maxLength: 30, required: true, helpText: 'For example, Sep 2021.' }),
        text('experience.end_date', { label: 'End date', maxLength: 30, helpText: 'Leave blank if you still work here.' }),
        text('experience.description', { label: 'What you did there', maxLength: 1500, long: true }),
      ],
    },
  }),
};

/** The Presets the "Add question" menu offers, in menu order. */
export const PRESETS: Preset[] = [education, experience];
