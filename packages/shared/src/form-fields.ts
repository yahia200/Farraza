import { z } from 'zod';

export const MAX_FIELDS = 50;

const optionSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1).max(100),
});

/** Properties every field has, whatever its type. */
const base = {
  key: z.uuid(),
  label: z.string().trim().min(1).max(200),
  helpText: z.string().trim().max(500).nullable(),
  required: z.boolean(),
};

const shortText = z.object({
  ...base,
  type: z.literal('short_text'),
  config: z.object({ maxLength: z.number().int().min(1).max(500) }),
});

const longText = z.object({
  ...base,
  type: z.literal('long_text'),
  config: z.object({ maxLength: z.number().int().min(1).max(10000) }),
});

const singleSelect = z.object({
  ...base,
  type: z.literal('single_select'),
  config: z.object({
    options: z.array(optionSchema).min(2).max(50),
    /** Choosing one of these rejects the application automatically. */
    rejectOptionIds: z.array(z.uuid()),
  }),
});

const multiSelect = z.object({
  ...base,
  type: z.literal('multi_select'),
  config: z.object({
    options: z.array(optionSchema).min(2).max(50),
    maxSelections: z.number().int().min(1).nullable(),
  }),
});

const yesNo = z.object({
  ...base,
  type: z.literal('yes_no'),
  config: z.object({
    /** The answer that rejects the application, or null for no knockout. */
    rejectWhen: z.boolean().nullable(),
  }),
});

const file = z.object({
  ...base,
  type: z.literal('file'),
  config: z.object({
    allowedTypes: z.array(z.enum(['pdf', 'image', 'document'])).min(1),
    maxSizeMb: z.number().int().min(1).max(25),
  }),
});

export const formFieldSchema = z.discriminatedUnion('type', [
  shortText,
  longText,
  singleSelect,
  multiSelect,
  yesNo,
  file,
]);

export type FormField = z.infer<typeof formFieldSchema>;
export type FormFieldType = FormField['type'];

export const formFieldsSchema = z
  .array(formFieldSchema)
  .max(MAX_FIELDS)
  .superRefine((fields, ctx) => {
    const keys = new Set<string>();

    fields.forEach((field, index) => {
      if (keys.has(field.key)) {
        ctx.addIssue({ code: 'custom', message: 'Field keys must be unique', path: [index, 'key'] });
      }
      keys.add(field.key);

      if (field.type !== 'single_select' && field.type !== 'multi_select') {
        return;
      }

      const optionIds = new Set(field.config.options.map((option) => option.id));
      if (optionIds.size !== field.config.options.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Option ids must be unique',
          path: [index, 'config', 'options'],
        });
      }

      if (field.type === 'single_select') {
        const unknown = field.config.rejectOptionIds.some((id) => !optionIds.has(id));
        if (unknown) {
          ctx.addIssue({
            code: 'custom',
            message: 'A knockout rule refers to an option that does not exist',
            path: [index, 'config', 'rejectOptionIds'],
          });
        }
      }

      if (
        field.type === 'multi_select' &&
        field.config.maxSelections !== null &&
        field.config.maxSelections > field.config.options.length
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'maxSelections cannot exceed the number of options',
          path: [index, 'config', 'maxSelections'],
        });
      }
    });
  });

export type FormFields = z.infer<typeof formFieldsSchema>;

export interface FieldError {
  /** Where the problem is, such as "2.config.options". */
  path: string;
  message: string;
}

export type ParseResult =
  | { ok: true; fields: FormFields }
  | { ok: false; errors: FieldError[] };

/** Validates a field list from an untrusted source. */
export function parseFormFields(input: unknown): ParseResult {
  const result = formFieldsSchema.safeParse(input);
  if (result.success) {
    return { ok: true, fields: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}