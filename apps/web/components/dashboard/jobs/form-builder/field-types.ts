import {
  CheckSquareIcon,
  CircleDotIcon,
  PaperclipIcon,
  PilcrowIcon,
  ToggleLeftIcon,
  TypeIcon,
  type LucideIcon,
} from 'lucide-react';
import { suggestedMaxSizeMb, type FileKind, type FormField, type FormFieldType } from '@repo/shared';

/** The question types the builder offers, with what a new one starts as. */
export const FIELD_TYPES: Record<FormFieldType, { label: string; icon: LucideIcon }> = {
  short_text: { label: 'Short text', icon: TypeIcon },
  long_text: { label: 'Long text', icon: PilcrowIcon },
  single_select: { label: 'Single choice', icon: CircleDotIcon },
  multi_select: { label: 'Multiple choice', icon: CheckSquareIcon },
  yes_no: { label: 'Yes / No', icon: ToggleLeftIcon },
  file: { label: 'File upload', icon: PaperclipIcon },
};

export const BUILDER_TYPES = Object.keys(FIELD_TYPES) as FormFieldType[];

/** How the builder names each kind of file a file question can accept, and which formats that means. */
export const FILE_KIND_OPTIONS: Record<FileKind, { label: string; formats: string }> = {
  document: { label: 'Documents', formats: 'PDF, DOCX' },
  image: { label: 'Images', formats: 'JPEG, PNG, WebP' },
  video: { label: 'Video', formats: 'MP4, MOV, WebM' },
  audio: { label: 'Audio', formats: 'MP3, M4A, WAV, OGG, WebM' },
};

/** Every id is a UUID made in the browser; question keys stay the same across versions. */
const newOption = (label: string) => ({ id: crypto.randomUUID(), label });

export function newField(type: FormFieldType): FormField {
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
      // Documents, with the size the builder suggests for them (spec: 10 MB); the length limit is for video and audio.
      return { ...base, type, config: { kinds: ['document'], maxSizeMb: suggestedMaxSizeMb(['document']), maxDurationSeconds: null } };
  }
}

export { newOption };

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
