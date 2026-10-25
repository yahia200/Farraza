/**
 * The Preset key catalog (ADR-0004): every key a Question may carry to say
 * what it asks for, and the question type that key requires. A Preset key
 * survives relabelling, so a future CV autofill can find a school or a job
 * title wherever the recruiter put it.
 *
 * APPEND-ONLY. Add keys freely; never remove a key and never change the type
 * a key requires. A published form version is immutable and keeps whatever
 * keys it was saved with, and a recruiter's edit of the draft copied from it
 * goes through `parseFormFields` again. If a key left the catalog, or its type
 * changed, that old form would stop loading and its draft could not be edited.
 * To retire a Preset, stop offering it in the builder and leave its keys here.
 */

/**
 * The question types a key can require; the same names as `FormField['type']`. This is a copy,
 * not derived: form-fields.ts imports this file, so importing `FormFieldType` back makes the
 * types circular. form-fields.ts asserts at compile time that every type used below is a real
 * question type; `checkPresetKey` there guards each key's type at run time.
 */
type PresetQuestionType =
  | 'short_text'
  | 'long_text'
  | 'single_select'
  | 'multi_select'
  | 'yes_no'
  | 'file'
  | 'repeating_group';

export const PRESET_KEY_TYPES = {
  // Education: the group and its five sub-questions.
  education: 'repeating_group',
  'education.school': 'short_text',
  'education.degree': 'single_select',
  'education.field_of_study': 'short_text',
  'education.start_year': 'short_text',
  'education.end_year': 'short_text',
  // Experience: the group and its five sub-questions.
  experience: 'repeating_group',
  'experience.job_title': 'short_text',
  'experience.company': 'short_text',
  'experience.start_date': 'short_text',
  'experience.end_date': 'short_text',
  'experience.description': 'long_text',
} as const satisfies Record<string, PresetQuestionType>;

export type PresetKey = keyof typeof PRESET_KEY_TYPES;

/** Every Preset key, for building a schema from the catalog. */
export const PRESET_KEYS = Object.keys(PRESET_KEY_TYPES) as [PresetKey, ...PresetKey[]];
