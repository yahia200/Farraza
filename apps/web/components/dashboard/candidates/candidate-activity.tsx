'use client';

import { useOptimistic, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createNoteSchema, type CreateNoteInput } from '@repo/shared';
import { addApplicationNote, type AddNoteResult } from '@/app/actions/applications';
import { applyActionFailure } from '@/components/forms/apply-action-failure';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { ActivityItem } from './activity-items';

/** Source of a unique id per pending note, made when a note is submitted: the optimistic reducer must stay pure. */
let pendingNotes = 0;

/**
 * The activity timeline and the note composer. A client component because a
 * posted note is shown in the timeline straight away (`useOptimistic`, shown
 * until the action finishes and the refreshed page brings the saved note),
 * https://react.dev/reference/react/useOptimistic. Every role can add a note.
 */
export function CandidateActivity({
  companySlug,
  jobSlug,
  applicationId,
  items,
}: {
  companySlug: string;
  jobSlug: string;
  applicationId: string;
  items: ActivityItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticItems, addOptimisticNote] = useOptimistic(
    items,
    (state, note: { id: string; body: string }): ActivityItem[] => [
      ...state,
      { kind: 'note', id: note.id, body: note.body, author: 'You', at: 'Sending…', pending: true },
    ],
  );
  const form = useForm<CreateNoteInput>({
    resolver: zodResolver(createNoteSchema),
    defaultValues: { body: '' },
  });

  function onSubmit({ body }: CreateNoteInput) {
    startTransition(async () => {
      addOptimisticNote({ id: `pending-${pendingNotes++}`, body });
      // Clear the box now that the note is in the list; put the text back if it fails.
      form.reset({ body: '' });
      let result: AddNoteResult;
      try {
        result = await addApplicationNote(companySlug, jobSlug, applicationId, body);
      } catch {
        // The request itself failed (offline, server down). Keep the text rather than lose it to the error boundary.
        result = { formError: 'Check your connection and try again.' };
      }
      if (!result.ok) {
        // The optimistic note disappears when the transition ends; give the text back unless they've started a new note.
        if (!form.getValues('body')) {
          form.reset({ body });
        }
        // A message about the note itself shows under the box; anything else is a toast.
        const formError = applyActionFailure(form, result);
        if (formError) {
          toast.add({ type: 'error', title: "Couldn't add the note", description: formError });
        }
      }
    });
  }

  return (
    <section aria-labelledby="candidate-activity" className="flex flex-col gap-4">
      <h3 id="candidate-activity" className="text-sm font-medium">
        Activity
      </h3>
      <ol className="flex flex-col gap-4 border-l pl-4">
        {optimisticItems.map((item) => (
          <li key={item.id} className="relative">
            <span aria-hidden className="absolute top-1.5 -left-[1.3125rem] size-2.5 rounded-full border bg-background" />
            {item.kind === 'note' ? (
              <div className={cn('flex flex-col gap-1 rounded-2xl bg-muted/50 p-3', item.pending && 'opacity-60')}>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{item.author}</span>
                  <span className="text-xs text-muted-foreground">{item.at}</span>
                </p>
                <p className="break-words whitespace-pre-line">{item.body}</p>
              </div>
            ) : (
              <p className="flex flex-col">
                <span>{item.text}</span>
                <span className="text-xs text-muted-foreground">{item.at}</span>
              </p>
            )}
          </li>
        ))}
      </ol>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mt-2 flex flex-col gap-3">
        <Controller
          name="body"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="candidate-note-body">Add a note</FieldLabel>
              <Textarea
                {...field}
                id="candidate-note-body"
                rows={3}
                placeholder="Write something for the team"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" className="self-start" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Add note
        </Button>
      </form>
    </section>
  );
}
