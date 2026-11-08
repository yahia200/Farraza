import { CircleCheckIcon, CircleMinusIcon, CircleXIcon } from 'lucide-react';
import { bandLabel, matchStateNote, requirementRows } from '@repo/shared';
import type { CvState, EmbeddingMatchDetailView, RequirementCheckView } from '@/lib/dal';
import { Badge } from '@/components/ui/badge';
import { MissedMustHaveMarker } from './missed-must-have-marker';

/**
 * The sheet's "Requirements" section (keyword match): each Requirement of the version the CV was
 * checked against, matched or not matched, with the keywords found, or "Not checked" for a Requirement
 * with no keywords (neither a hit nor a miss; only the embedding match looks at it). The verdict is words
 * and an icon, never colour alone.
 *
 * Beside each verdict sits the embedding match's band (Strong / Related / Weak, `bandLabel`), or one line
 * under the heading for an Application that is not scored ("Scoring…", "Not scored: <reason>",
 * `matchStateNote`). The two layers are separate: the "Missing must-have" marker comes from the keyword
 * check alone, and a band never sets or clears it. A band says how on-topic the CV is, not how deep the
 * skill goes, so the wording says "Topic match" and a note under the list says so. Raw scores never reach
 * this component: the API sends bands only. The rows are joined by `requirementRows` (`@repo/shared`).
 *
 * - `unreadable` / `failed`: only "CV could not be read". Never a marker or a "not matched", because a
 *   failed read must not look like a missing skill (the API sends no check for these states either).
 * - `none`, or readable but never checked, or a checked version with no Requirements: nothing at all.
 *
 * A Server Component: it only displays what the API stored.
 */
export function CandidateRequirements({
  cvState,
  check,
  embeddingMatch,
}: {
  cvState: CvState;
  check: RequirementCheckView | null;
  embeddingMatch: EmbeddingMatchDetailView | null;
}) {
  if (cvState === 'unreadable' || cvState === 'failed') {
    return (
      <section aria-labelledby="candidate-requirements" className="flex flex-col gap-3">
        <h3 id="candidate-requirements" className="text-sm font-medium">
          Requirements
        </h3>
        <p className="text-muted-foreground">CV could not be read.</p>
      </section>
    );
  }
  if (cvState !== 'readable') return null;

  const rows = requirementRows(check, embeddingMatch);
  const stateNote = matchStateNote(embeddingMatch?.state ?? null);
  const showsBand = rows.some((row) => row.band !== null);
  if (rows.length === 0 && !stateNote) return null;

  return (
    <section aria-labelledby="candidate-requirements" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="candidate-requirements" className="text-sm font-medium">
          Requirements
        </h3>
        {check?.missedMustHave && <MissedMustHaveMarker />}
      </div>
      {stateNote && <p className="text-xs text-muted-foreground">{stateNote}</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-2">
            {row.verdict === null || row.verdict.kind === 'not_checked' ? (
              <CircleMinusIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : row.verdict.kind === 'matched' ? (
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <CircleXIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="wrap-anywhere">
                {row.text}{' '}
                <Badge variant={row.tier === 'must_have' ? 'secondary' : 'outline'}>
                  {row.tier === 'must_have' ? 'Must-have' : 'Nice-to-have'}
                </Badge>
              </span>
              {row.verdict && (
                <span className="text-xs text-muted-foreground wrap-anywhere">
                  Keywords:{' '}
                  {row.verdict.kind === 'not_checked'
                    ? 'Not checked'
                    : row.verdict.kind === 'matched'
                      ? `Matched: ${row.verdict.terms.join(', ')}`
                      : 'Not matched'}
                </span>
              )}
              {row.band && (
                <span className="text-xs text-muted-foreground">
                  Topic match: <span className="font-medium text-foreground">{bandLabel(row.band)}</span>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {showsBand && (
        <p className="text-xs text-muted-foreground">
          Topic match shows how closely the CV talks about each Requirement. It does not show how deep the
          experience goes, and it never changes the keyword check.
        </p>
      )}
    </section>
  );
}
