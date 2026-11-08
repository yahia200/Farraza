import type { MatchBand } from './embedding-match.js';

/**
 * How the candidate sheet words the embedding match (Layer 3) beside the keyword match (Layer 2)
 * (embedding-match ticket 09). Pure, so the wording is tested here and the web component only draws it.
 * The match state and band are structural copies of what the detail payload carries
 * (`apps/api/src/pipeline/pipeline.ts`), so this module needs nothing from the API or the web app.
 */

export type MatchStateInput =
  | { status: 'scoring' }
  | { status: 'scored' }
  | { status: 'not_scored'; reason: 'cv_unreadable' | 'embedder_failed' | 'model_changed' };

/** The sheet's three band labels. A band ranks by topic, not by depth, so the sheet never says "met". */
const BAND_LABELS: Record<MatchBand, string> = {
  strong: 'Strong',
  related: 'Related',
  weak: 'Weak',
};

export function bandLabel(band: MatchBand): string {
  return BAND_LABELS[band];
}

/**
 * The one line the sheet shows for an Application that is not (yet) scored: "Scoring…" while pending,
 * "Not scored: <plain reason>" otherwise. Null when there is nothing to say: no score row (like Layer 2
 * with no CV) or already scored (each Requirement then shows its band).
 */
export function matchStateNote(state: MatchStateInput | null): string | null {
  if (state === null || state.status === 'scored') return null;
  if (state.status === 'scoring') return 'Scoring…';
  switch (state.reason) {
    case 'cv_unreadable':
      return 'Not scored: the CV could not be read.';
    case 'embedder_failed':
      return 'Not scored: the scoring service failed.';
    case 'model_changed':
      return 'Not scored: the scoring model has changed since this was scored.';
  }
}

type Tier = 'must_have' | 'nice_to_have';

/** The part of the Layer 2 check this module reads. `matched: null` is "not checked". */
export type KeywordCheckInput = {
  results: { id: string; text: string; tier: Tier; matched: boolean | null; terms: string[] }[];
};

/** The part of the Layer 3 detail this module reads. `band` is null unless the Application is scored. */
export type EmbeddingMatchInput = {
  requirements: { id: string; text: string; tier: Tier; band: MatchBand | null }[];
};

export type RequirementVerdict =
  | { kind: 'matched'; terms: string[] }
  | { kind: 'not_matched' }
  | { kind: 'not_checked' };

export type RequirementRow = {
  id: string;
  text: string;
  tier: Tier;
  /** Layer 2's verdict; null when Layer 2 has no result for this Requirement (a different version). */
  verdict: RequirementVerdict | null;
  /** Layer 3's band; null unless scored. Never a number. */
  band: MatchBand | null;
};

function verdictOf(result: KeywordCheckInput['results'][number]): RequirementVerdict {
  if (result.matched === null) return { kind: 'not_checked' };
  return result.matched ? { kind: 'matched', terms: result.terms } : { kind: 'not_matched' };
}

/**
 * One row per Requirement with both layers side by side, joined by Requirement id. Layer 2's list and
 * order come first; a Requirement only Layer 3 knows (the two layers were run against different versions)
 * follows, with no verdict. With no Layer 2 check at all, Layer 3's list stands alone. The layers stay
 * independent: nothing here combines a verdict and a band into one value.
 */
export function requirementRows(
  check: KeywordCheckInput | null,
  match: EmbeddingMatchInput | null,
): RequirementRow[] {
  const bands = new Map((match?.requirements ?? []).map((r) => [r.id, r.band] as const));
  const rows: RequirementRow[] = (check?.results ?? []).map((result) => ({
    id: result.id,
    text: result.text,
    tier: result.tier,
    verdict: verdictOf(result),
    band: bands.get(result.id) ?? null,
  }));
  const seen = new Set(rows.map((row) => row.id));
  for (const requirement of match?.requirements ?? []) {
    if (seen.has(requirement.id)) continue;
    rows.push({
      id: requirement.id,
      text: requirement.text,
      tier: requirement.tier,
      verdict: null,
      band: requirement.band,
    });
  }
  return rows;
}
