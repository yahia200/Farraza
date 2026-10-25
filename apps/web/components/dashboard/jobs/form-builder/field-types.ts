import {
  CheckSquareIcon,
  CircleDotIcon,
  ListIcon,
  PaperclipIcon,
  PilcrowIcon,
  ToggleLeftIcon,
  TypeIcon,
  type LucideIcon,
} from 'lucide-react';
import type { Path } from 'react-hook-form';
import { suggestedMaxSizeMb, type FileKind, type FormField, type FormFieldType } from '@repo/shared';
import type { BuilderValues } from './question-card';

/**
 * The question types a hand-built question can have, and the ones `newField` can make. A repeating
 * group is left out on purpose: the builder only inserts one from a Preset (ADR-0004).
 */
export type BuilderFieldType = Exclude<FormFieldType, 'repeating_group'>;

/**
 * The label and icon for every question type the builder can show on a card, a repeating group
 * included: a Preset inserts one, so `QuestionCard` needs its label and icon, and `GroupEditor`
 * names each sub-question's type from here. It is a lookup, not the menu: see `BUILDER_TYPES`.
 */
export const FIELD_TYPES: Record<FormFieldType, { label: string; icon: LucideIcon }> = {
  short_text: { label: 'Short text', icon: TypeIcon },
  long_text: { label: 'Long text', icon: PilcrowIcon },
  single_select: { label: 'Single choice', icon: CircleDotIcon },
  multi_select: { label: 'Multiple choice', icon: CheckSquareIcon },
  yes_no: { label: 'Yes / No', icon: ToggleLeftIcon },
  file: { label: 'File upload', icon: PaperclipIcon },
  repeating_group: { label: 'Repeating group', icon: ListIcon },
};

/** The question types the "Add question" menu lists: every type in `FIELD_TYPES` except `repeating_group`, which only a Preset adds. */
export const BUILDER_TYPES = (Object.keys(FIELD_TYPES) as FormFieldType[]).filter(
  (type): type is BuilderFieldType => type !== 'repeating_group',
);

/** How the builder names each kind of file a file question can accept, and which formats that means. */
export const FILE_KIND_OPTIONS: Record<FileKind, { label: string; formats: string }> = {
  document: { label: 'Documents', formats: 'PDF, DOCX' },
  image: { label: 'Images', formats: 'JPEG, PNG, WebP' },
  video: { label: 'Video', formats: 'MP4, MOV, WebM' },
  audio: { label: 'Audio', formats: 'MP3, M4A, WAV, OGG, WebM' },
};

/** Every id is a UUID made in the browser; question keys stay the same across versions. */
const newOption = (label: string) => ({ id: crypto.randomUUID(), label });

export function newField(type: BuilderFieldType): FormField {
  const base = { key: crypto.randomUUID(), label: '', helpText: null, required: true };
  switch (type) {
    case 'short_text':
      return { ...base, type, config: { maxLength: 200 } };
    case 'long_text':
      return { ...base, type, config: { maxLength: 5000 } };
    case 'single_select':
      return { ...base, type, config: { options: [newOption('Option 1'), newOption('Option 2')], rejectOptionIds: [] } };
    case 'multi_select':
      return { ...base, type, config: { options: [newOption('Option 1'), newOption('Option 2')], maxSelections: null } };
    case 'yes_no':
      return { ...base, type, config: { rejectWhen: null } };
    case 'file':
      // Documents, with the size the builder suggests for them (spec: 10 MB); the length limit is only for video and audio, so it starts empty.
      return { ...base, type, config: { kinds: ['document'], maxSizeMb: suggestedMaxSizeMb(['document']), maxDurationSeconds: null } };
  }
}

export { newOption };

/**
 * The RHF path to one setting of a question or sub-question, cast once here:
 * the question types are a union, and a path like `config.maxLength` exists only on some of them.
 * `prefix` is where the question sits, `fields.2` for a top-level question or
 * `fields.2.config.fields.0` for a sub-question of a group, so one editor works at both levels.
 */
export const at = (prefix: string, rest: string) => `${prefix}.${rest}` as Path<BuilderValues>;

/**
 * Reads a nested error from RHF's `formState.errors` by a dotted path
 * ("fields.2.config.options"). Array-level errors can sit on `.root`.
 */
export function errorAt(errors: unknown, path: string): string | undefined {
  let node: unknown = errors;
  for (const key of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  const found = node as { message?: string; root?: { message?: string } } | undefined;
  return found?.message ?? found?.root?.message;
}

/** Whether RHF holds any error at or below a dotted path ("fields.2.config.fields.0"). */
export function hasErrorAt(errors: unknown, path: string): boolean {
  let node: unknown = errors;
  for (const key of path.split('.')) {
    if (node === null || typeof node !== 'object') return false;
    node = (node as Record<string, unknown>)[key];
  }
  return node != null;
}
