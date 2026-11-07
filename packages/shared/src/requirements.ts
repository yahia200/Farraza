import { z } from 'zod';
import { RELOAD_MESSAGE } from './messages.js';

/**
 * Requirements (.scratch/keyword-match/spec.md "Shared", GLOSSARY.md "Requirement"): what a manager
 * says a Candidate should have, with the keywords that count as evidence in the CV text.
 *
 * Pure and server-or-browser safe. A Requirement is checked against CV text only and only advises.
 */

/** Placeholder caps, easy to raise. */
export const REQUIREMENTS_LIMIT = 10;
export const REQUIREMENT_KEYWORDS_LIMIT = 15;
export const REQUIREMENT_KEYWORD_MAX_LENGTH = 40;
export const REQUIREMENT_TEXT_MAX_LENGTH = 200;

export const REQUIREMENT_TIERS = ['must_have', 'nice_to_have'] as const;

const keywordSchema = z
  .string({ error: 'Enter a keyword.' })
  .trim()
  .min(1, { error: 'Enter a keyword.' })
  .max(REQUIREMENT_KEYWORD_MAX_LENGTH, {
    error: `Keywords must be ${REQUIREMENT_KEYWORD_MAX_LENGTH} characters or fewer.`,
  });

export const requirementSchema = z.object({
  /** Stable across versions, so a result can be matched to its Requirement. */
  id: z.uuid({ error: RELOAD_MESSAGE }),
  text: z
    .string({ error: 'Describe the requirement.' })
    .trim()
    .min(1, { error: 'Describe the requirement.' })
    .max(REQUIREMENT_TEXT_MAX_LENGTH, {
      error: `Use ${REQUIREMENT_TEXT_MAX_LENGTH} characters or fewer.`,
    }),
  tier: z.enum(REQUIREMENT_TIERS, { error: RELOAD_MESSAGE }),
  keywords: z
    .array(keywordSchema, { error: RELOAD_MESSAGE })
    .min(1, { error: 'Add at least one keyword.' })
    .max(REQUIREMENT_KEYWORDS_LIMIT, {
      error: `Add at most ${REQUIREMENT_KEYWORDS_LIMIT} keywords.`,
    }),
});
export type Requirement = z.infer<typeof requirementSchema>;
export type RequirementTier = Requirement['tier'];

/** The list a Job stores. An empty list is valid (no Requirements). Ids are unique. */
export const requirementsSchema = z
  .array(requirementSchema, { error: RELOAD_MESSAGE })
  .max(REQUIREMENTS_LIMIT, { error: `Add at most ${REQUIREMENTS_LIMIT} requirements.` })
  .superRefine((list, ctx) => {
    list.forEach((item, index) => {
      if (list.findIndex((other) => other.id === item.id) !== index) {
        ctx.addIssue({ code: 'custom', message: RELOAD_MESSAGE, path: [index, 'id'] });
      }
    });
  });

/** The result for one Requirement: whether any keyword matched, and which keywords (as listed) did. */
export type RequirementMatch = { matched: boolean; terms: string[] };
export type RequirementMatches = Record<string, RequirementMatch>;

const isWordChar = (char: string | undefined): boolean =>
  char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** Whether `needle` occurs in `haystack` with no letter or digit directly before or after it. */
function containsWhole(haystack: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const before = [...haystack.slice(Math.max(0, at - 2), at)].pop();
    const after = [...haystack.slice(at + needle.length, at + needle.length + 2)][0];
    if (!isWordChar(before) && !isWordChar(after)) return true;
    from = at + 1;
  }
}

/**
 * The forms of a keyword that count: as written, with a trailing "s", and (for words longer than three
 * letters, so "aws" stays "aws") without one. Nothing else is normalised: other synonyms are the
 * manager's to list. Surrounding punctuation in the CV needs no handling, since a match only has to
 * avoid letters and digits on either side.
 */
function forms(keyword: string): string[] {
  const base = keyword.trim().toLowerCase();
  const out = [base, `${base}s`];
  if (base.length > 3 && base.endsWith('s')) out.push(base.slice(0, -1));
  return out;
}

/**
 * Checks CV text against Requirements: case-insensitive, literal (no regex), whole-word. A Requirement
 * matches when any one keyword does. Negation is not detected ("no experience with Postgres" matches);
 * that is a known, accepted limit.
 */
export function matchRequirements(
  requirements: readonly Requirement[],
  cvText: string,
): RequirementMatches {
  const text = cvText.toLowerCase();
  const results: RequirementMatches = {};
  for (const requirement of requirements) {
    const terms = requirement.keywords.filter((keyword) =>
      forms(keyword).some((form) => form !== '' && containsWhole(text, form)),
    );
    results[requirement.id] = { matched: terms.length > 0, terms };
  }
  return results;
}

/** True when a must-have Requirement did not match. A Requirement with no result counts as not matched. */
export function missedMustHave(
  requirements: readonly Requirement[],
  matches: RequirementMatches,
): boolean {
  return requirements.some(
    (requirement) => requirement.tier === 'must_have' && !matches[requirement.id]?.matched,
  );
}
