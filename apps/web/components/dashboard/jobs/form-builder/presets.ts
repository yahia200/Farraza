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

/** A whole-number sub-question (a year): optional unless said so. */
function year(presetKey: PresetKey, label: string, min: number, max: number, helpText?: string): LeafFormField {
  return { ...leafBase(presetKey, label, false, helpText), type: 'number', config: { min, max, integerOnly: true } };
}

/** A date sub-question with no limits: optional unless `required`. */
function date(presetKey: PresetKey, label: string, required: boolean, helpText?: string): LeafFormField {
  return { ...leafBase(presetKey, label, required, helpText), type: 'date', config: { min: null, max: null } };
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
        year('education.start_year', 'Start year', 1950, 2100),
        year('education.end_year', 'End year', 1950, 2100, 'An expected year is fine if you have not finished yet.'),
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
        date('experience.start_date', 'Start date', true),
        date('experience.end_date', 'End date', false, 'Leave blank if you still work here.'),
        text('experience.description', { label: 'What you did there', maxLength: 1500, long: true }),
      ],
    },
  }),
};

/** The Presets the "Add question" menu offers, in menu order. */
export const PRESETS: Preset[] = [education, experience];
