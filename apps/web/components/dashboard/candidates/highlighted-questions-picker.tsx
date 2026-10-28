'use client';

import { HIGHLIGHT_LIMIT } from '@repo/shared';
import { Settings2Icon } from 'lucide-react';
import { startTransition, useId, useOptimistic, useState } from 'react';
import { saveHighlightedQuestions, type SaveHighlightedQuestionsResult } from '@/app/actions/jobs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from '@/components/ui/toast';
import type { HighlightedQuestion } from '@/lib/dal';

/**
 * Lets a person who can manage jobs choose the Job's Highlighted questions:
 * a ghost icon button beside the Table/Board toggle opens a popover with one
 * checkbox per highlightable Question of the latest published form, in form
 * order (`questions`, built by the page with `highlightableQuestions`).
 *
 * Every tick saves at once: the whole new list goes to the
 * `saveHighlightedQuestions` action. `useOptimistic` shows the tick while the
 * action runs; when its transition ends the boxes show `savedKeys` again,
 * which the action's revalidation has refreshed after a success and left as
 * it was after a failure, so a failed save unticks itself and a toast says
 * why. Next.js sends Server Actions one at a time per client, so quick ticks
 * reach the API in the order they were made.
 *
 * `savedKeys` may hold keys the form no longer asks (they are never cleaned
 * up at publish); they are not shown, don't count toward the limit, and the
 * next save leaves them out.
 */
export function HighlightedQuestionsPicker({
  companySlug,
  jobSlug,
  questions,
  savedKeys,
}: {
  companySlug: string;
  jobSlug: string;
  /** The latest published form's highlightable Questions, key and label only. */
  questions: HighlightedQuestion[];
  savedKeys: string[];
}) {
  const saved = questions.filter((question) => savedKeys.includes(question.key)).map((question) => question.key);
  const [keys, setKeys] = useOptimistic(saved);
  const [announcement, setAnnouncement] = useState('');
  const limitId = useId();
  const atLimit = keys.length >= HIGHLIGHT_LIMIT;

  function toggle(key: string, checked: boolean) {
    const chosen = new Set(keys);
    if (checked) {
      if (atLimit) return;
      chosen.add(key);
    } else {
      chosen.delete(key);
    }
    // Form order, so the stored list reads the way the table shows it.
    const next = questions.filter((question) => chosen.has(question.key)).map((question) => question.key);
    const label = questions.find((question) => question.key === key)?.label ?? 'the question';

    startTransition(async () => {
      setKeys(next);
      let result: SaveHighlightedQuestionsResult;
      try {
        result = await saveHighlightedQuestions(companySlug, jobSlug, next);
      } catch {
        // The request itself failed (offline, server down). The box goes back when the transition ends.
        result = { formError: 'Check your connection and try again.' };
      }
      if (result.keys) {
        setAnnouncement(checked ? `Showing “${label}” in the list.` : `Stopped showing “${label}” in the list.`);
      } else {
        setAnnouncement('');
        toast.add({
          type: 'error',
          title: "Couldn't change the questions shown",
          description: result.formError,
        });
      }
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Choose questions to show" />}
        className="text-muted-foreground"
      >
        <Settings2Icon />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>Questions shown in the list</PopoverTitle>
          <PopoverDescription>
            Their answers show on every application, in the table and on the board. Everyone viewing this job sees the
            same choice.
          </PopoverDescription>
        </PopoverHeader>
        {questions.length === 0 ? (
          <p className="text-muted-foreground">
            The published form has no question that fits on one line. Text, choice, yes/no, number, date and link
            questions can be shown.
          </p>
        ) : (
          <fieldset
            aria-describedby={limitId}
            className="-mx-1 flex max-h-[min(20rem,calc(var(--available-height)-10rem))] min-w-0 flex-col gap-1 overflow-y-auto px-1"
          >
            <legend className="sr-only">Questions</legend>
            {questions.map((question) => {
              const checked = keys.includes(question.key);
              return (
                // The Checkbox is a span, so the Label's `peer-disabled` never matches; dim the row from its data-disabled.
                // `shrink-0`: once the list reaches its max height, the flex column would otherwise squeeze each row
                // down to its `min-h`, and a Question that wraps would overlap the rows around it instead of scrolling.
                <Label
                  key={question.key}
                  className="min-h-11 shrink-0 py-1 leading-snug font-normal has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50 sm:min-h-8"
                >
                  <Checkbox
                    checked={checked}
                    disabled={!checked && atLimit}
                    onCheckedChange={(next) => toggle(question.key, next)}
                  />
                  <span className="min-w-0 break-words">{question.label}</span>
                </Label>
              );
            })}
          </fieldset>
        )}
        {questions.length > 0 && (
          <p id={limitId} className="text-muted-foreground">
            {atLimit
              ? `You can show up to ${HIGHLIGHT_LIMIT} questions. Untick one to choose another.`
              : `Choose up to ${HIGHLIGHT_LIMIT}.`}
          </p>
        )}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </PopoverContent>
    </Popover>
  );
}
