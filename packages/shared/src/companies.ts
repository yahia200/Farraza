import { z } from 'zod';

/** Request bodies for the API's /companies endpoints. */

/** Roles that can be given out; `owner` is only assigned when a company is created. */
export const assignableRoleSchema = z.enum(['admin', 'recruiter', 'interviewer'], {
  error: 'Choose a role: admin, recruiter or interviewer.',
});
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

const companyName = z
  .string({ error: 'Enter a company name.' })
  .min(2,{ error: 'Company name must be at least 2 characters.' })
  .max(100, { error: 'Company name must be 100 characters or fewer.' });

export const createCompanySchema = z.strictObject({ name: companyName });
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

const LOGO_URL_ERROR = 'Enter a link that starts with https://.';
const BRAND_COLOR_ERROR = 'Enter a color as # and 6 hex digits, like #1a73e8.';

// HTTPS only: the logo is shown on the public apply page, where an http://
// image is mixed content. This also rules out javascript: and data: URLs.
const logoUrl = z
  .url({ protocol: /^https$/, error: LOGO_URL_ERROR })
  .max(2048, { error: 'Logo links must be 2,048 characters or fewer.' });

// Same rule as the companies_brand_color_format CHECK in contract.prisma.
const brandColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: BRAND_COLOR_ERROR }).toLowerCase();

/**
 * Company settings. A missing key leaves that setting unchanged; `null`
 * removes the logo or brand color (`name` can't be removed).
 */
export const updateCompanySchema = z.strictObject({
  name: companyName.optional(),
  logoUrl: logoUrl.nullish(),
  brandColor: brandColor.nullish(),
});
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

/**
 * The settings form, where every input is text and "" means "none". Same
 * rules as updateCompanySchema; the web app's Server Action turns "" into
 * null before calling the API.
 */
export const companySettingsFormSchema = z.object({
  name: companyName,
  logoUrl: z.union([z.literal(''), logoUrl], { error: LOGO_URL_ERROR }),
  brandColor: z.union([z.literal(''), brandColor], { error: BRAND_COLOR_ERROR }),
});
export type CompanySettingsFormInput = z.infer<typeof companySettingsFormSchema>;

/** Just the logo and color: the optional second step of adding a company. */
export const companyBrandingFormSchema = companySettingsFormSchema.pick({ logoUrl: true, brandColor: true });
export type CompanyBrandingFormInput = z.infer<typeof companyBrandingFormSchema>;

export const addMemberSchema = z.strictObject({
  email: z.email({ error: 'Enter a valid email address.' }),
  role: assignableRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberSchema = z.strictObject({
  role: assignableRoleSchema,
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
