import type { StageKind } from '@repo/shared';
import { unstable_rethrow } from 'next/navigation';
import { BanIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { getApplication, getApplicationFiles, getCurrentUser } from '@/lib/dal';
import { formatDate } from '@/lib/format';
import { toActivityItems } from './activity-items';
import { CandidateAnswer } from './candidate-answer';
import { CandidateActivity } from './candidate-activity';
import { CandidateFile } from './candidate-file';
import { CandidateMove } from './candidate-move';
import { CandidateRatings } from './candidate-ratings';
import { CandidateStageBadges } from './candidate-stage-badges';
import { formatAnswer } from './format-answer';

/**
 * One candidate's application: contact details, stage, the answers to the
 * form version they saw, the Ratings, and the activity timeline with a note composer. A
 * Server Component, rendered inside the sheet when the URL has ?application=<id>.
 */
export async function CandidateDetail({
  companySlug,
  jobSlug,
  applicationId,
  stages,
  canMove,
  ratingCriteria,
}: {
  companySlug: string;
  jobSlug: string;
  applicationId: string;
  /** The job's stages, for the "Move to stage" control (and the status a move gives). */
  stages: { id: string; name: string; kind: StageKind }[];
  /** canMoveApplications(role): interviewers get no move control. */
  canMove: boolean;
  /** The Job's rating Criteria now (catalog keys): the detail doesn't carry them, and the control scores only these. */
  ratingCriteria: string[];
}) {
  // Together, as they don't depend on each other. If the files can't be loaded, `files` is null
  // and the sheet says so instead of claiming the candidate sent none.
  const [application, files, currentUser] = await Promise.all([
    getApplication(companySlug, jobSlug, applicationId),
    getApplicationFiles(companySlug, jobSlug, applicationId).catch((error: unknown) => {
      unstable_rethrow(error); // a redirect to sign-in must not be swallowed
      return null;
    }),
    getCurrentUser(), // to find the viewer's own Rating; this renders inside the page's <Suspense>
  ]);

  if (!application) {
    return (
      <SheetHeader>
        <SheetTitle>Candidate not found</SheetTitle>
        <SheetDescription>This application doesn&apos;t exist or isn&apos;t part of this job.</SheetDescription>
      </SheetHeader>
    );
  }

  const { candidate, stage, fields, cvMode, answers, autoRejectedBy } = application;
  const cv = files?.find((file) => file.purpose === 'cv');

  return (
    <>
      <SheetHeader className="gap-3 border-b pr-14">
        <div className="flex flex-col gap-1">
          <SheetTitle className="text-lg">{candidate.name}</SheetTitle>
          <SheetDescription>
            Applied {formatDate(application.submittedAt)}
            {application.source && <> via {application.source}</>}
          </SheetDescription>
        </div>
        {canMove ? (
          // Renders the badges too, so they follow the optimistic stage.
          <CandidateMove
            companySlug={companySlug}
            jobSlug={jobSlug}
            applicationId={application.id}
            stageId={stage.id}
            status={application.status}
            stages={stages}
          />
        ) : (
          <CandidateStageBadges stageName={stage.name} status={application.status} />
        )}
      </SheetHeader>

      <div className="flex flex-col gap-6 p-4">
        {autoRejectedBy && (
          <Alert>
            <BanIcon />
            <AlertTitle>Rejected automatically</AlertTitle>
            <AlertDescription>
              Their answer to &ldquo;{autoRejectedBy.fieldLabel}&rdquo; matched an auto-reject rule.
            </AlertDescription>
          </Alert>
        )}

        <section aria-labelledby="candidate-contact" className="flex flex-col gap-3">
          <h3 id="candidate-contact" className="text-sm font-medium">
            Contact
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="min-w-0 truncate">
              <a href={`mailto:${candidate.email}`} className="underline-offset-4 hover:underline">
                {candidate.email}
              </a>
            </dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>
              <a href={`tel:${candidate.phone.replace(/[^+\d]/g, '')}`} className="underline-offset-4 hover:underline">
                {candidate.phone}
              </a>
            </dd>
          </dl>
        </section>

        {/* A form that never asked for a CV (`cvMode` off) can't have one: show no CV section at all. */}
        {(cv || cvMode !== 'off') && (
          <section aria-labelledby="candidate-cv" className="flex flex-col gap-3">
            <h3 id="candidate-cv" className="text-sm font-medium">
              CV
            </h3>
            {files === null ? (
              <p className="text-muted-foreground">Couldn&apos;t load the files. Reload the page to try again.</p>
            ) : cv ? (
              <CandidateFile file={cv} companySlug={companySlug} jobSlug={jobSlug} applicationId={application.id} />
            ) : (
              <p className="text-muted-foreground italic">No CV attached.</p>
            )}
          </section>
        )}

        <section aria-labelledby="candidate-answers" className="flex flex-col gap-3">
          <h3 id="candidate-answers" className="text-sm font-medium">
            Answers
          </h3>
          {fields.length === 0 ? (
            <p className="text-muted-foreground">The form only asked for contact details.</p>
          ) : (
            <dl className="flex flex-col gap-4">
              {fields.map((field) => {
                const answer = formatAnswer(field, answers[field.key]);
                // A file question's answer is the id of a file, shown as the file itself.
                const fileId = field.type === 'file' ? answers[field.key] : undefined;
                const file =
                  typeof fileId === 'string'
                    ? files?.find((f) => f.id === fileId && f.purpose === 'answer' && f.fieldKey === field.key)
                    : undefined;
                return (
                  <div key={field.key} className="flex flex-col gap-1">
                    <dt className="flex flex-wrap items-center gap-2 font-medium">
                      {field.label}
                      {autoRejectedBy?.fieldKey === field.key && <Badge variant="destructive">Auto-reject</Badge>}
                    </dt>
                    <dd className="text-muted-foreground">
                      {field.type === 'file' ? (
                        file ? (
                          <CandidateFile
                            file={file}
                            companySlug={companySlug}
                            jobSlug={jobSlug}
                            applicationId={application.id}
                          />
                        ) : typeof fileId !== 'string' ? (
                          <span className="italic">No answer</span>
                        ) : (
                          <span className="italic">
                            {files === null ? "Couldn't load the files." : 'This file is no longer available.'}
                          </span>
                        )
                      ) : (
                        <CandidateAnswer answer={answer} />
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </section>

        <CandidateRatings
          companySlug={companySlug}
          jobSlug={jobSlug}
          applicationId={application.id}
          currentUserId={currentUser.id}
          jobCriteria={ratingCriteria}
          ratings={application.ratings}
          summary={application.ratingSummary}
        />

        <CandidateActivity
          companySlug={companySlug}
          jobSlug={jobSlug}
          applicationId={application.id}
          items={toActivityItems(application.events, application.notes, application.ratings)}
        />
      </div>
    </>
  );
}

/** Fixed sizes only: no Math.random() in anything prerendered. */
export function CandidateDetailSkeleton() {
  return (
    <>
      <SheetHeader className="gap-3 border-b">
        <SheetTitle className="sr-only">Loading candidate</SheetTitle>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </SheetHeader>
      <div className="flex flex-col gap-6 p-4" aria-busy="true" aria-hidden="true">
        {/* Contact, Answers and Ratings: a heading, then label/value pairs. */}
        {[2, 3, 2].map((rows, section) => (
          <div key={section} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
