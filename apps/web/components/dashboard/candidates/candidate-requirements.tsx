import { CircleCheckIcon, CircleXIcon } from 'lucide-react';
import type { CvState, RequirementCheckView } from '@/lib/dal';
import { Badge } from '@/components/ui/badge';
import { MissedMustHaveMarker } from './missed-must-have-marker';

/**
 * The sheet's "Requirements" section (keyword match): each Requirement of the version the CV was
 * checked against, matched or not matched, with the keywords found. The verdict is words and an icon,
 * never colour alone.
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
}: {
  cvState: CvState;
  check: RequirementCheckView | null;
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
  if (cvState !== 'readable' || !check || check.results.length === 0) return null;

  return (
    <section aria-labelledby="candidate-requirements" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="candidate-requirements" className="text-sm font-medium">
          Requirements
        </h3>
        {check.missedMustHave && <MissedMustHaveMarker />}
      </div>
      <ul className="flex flex-col gap-3">
        {check.results.map((result) => (
          <li key={result.id} className="flex items-start gap-2">
            {result.matched ? (
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <CircleXIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="wrap-anywhere">
                {result.text}{' '}
                <Badge variant={result.tier === 'must_have' ? 'secondary' : 'outline'}>
                  {result.tier === 'must_have' ? 'Must-have' : 'Nice-to-have'}
                </Badge>
              </span>
              <span className="text-xs text-muted-foreground wrap-anywhere">
                {result.matched ? `Matched: ${result.terms.join(', ')}` : 'Not matched'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
