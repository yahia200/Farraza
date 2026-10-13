import {
  CheckSquareIcon,
  CircleDotIcon,
  PilcrowIcon,
  ToggleLeftIcon,
  TypeIcon,
  type LucideIcon,
} from 'lucide-react';
import type { FormField, FormFieldType } from '@repo/shared';

/**
 * The question types the builder offers, with what a new one starts as.
 * `file` is left out on purpose: the API has no upload endpoint yet, so a file
 * question couldn't be answered (packages/shared/src/form-fields.ts still allows it).
 */
export type BuilderFieldType = Exclude<FormFieldType, 'file'>;

export const FIELD_TYPES: Record<BuilderFieldType, { label: string; icon: LucideIcon }> = {
  short_text: { label: 'Short text', icon: TypeIcon },
  long_text: { label: 'Long text', icon: PilcrowIcon },
  single_select: { label: 'Single choice', icon: CircleDotIcon },
  multi_select: { label: 'Multiple choice', icon: CheckSquareIcon },
  yes_no: { label: 'Yes / No', icon: ToggleLeftIcon },
};

export const BUILDER_TYPES = Object.keys(FIELD_TYPES) as BuilderFieldType[];

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
  }
}

export { newOption };

/** A file question saved through the API before this builder existed still needs a label. */
export function typeLabel(type: FormFieldType): string {
  return type === 'file' ? 'File upload' : FIELD_TYPES[type].label;
}

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
