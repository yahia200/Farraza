import { z } from 'zod';

/** Request bodies for the API's /companies endpoints. */

/** Roles that can be given out; `owner` is only assigned when a company is created. */
export const assignableRoleSchema = z.enum(['admin', 'recruiter', 'interviewer'], {
  error: 'Choose a role: admin, recruiter or interviewer.',
});
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

export const createCompanySchema = z.strictObject({
  name: z
    .string()
    .min(2, { error: 'Company name must be at least 2 characters.' })
    .max(100, { error: 'Company name must be 100 characters or fewer.' }),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

/** Every field optional, the Zod equivalent of mapped-types' `PartialType`. */
export const updateCompanySchema = createCompanySchema.partial();
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const addMemberSchema = z.strictObject({
  email: z.email({ error: 'Enter a valid email address.' }),
  role: assignableRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberSchema = z.strictObject({
  role: assignableRoleSchema,
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
