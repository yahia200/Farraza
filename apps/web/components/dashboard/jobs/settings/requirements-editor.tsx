'use client';

import {
  addKeyword,
  moveItem,
  newRequirement,
  REQUIREMENT_KEYWORD_MAX_LENGTH,
  REQUIREMENT_KEYWORDS_LIMIT,
  REQUIREMENT_TEXT_MAX_LENGTH,
  REQUIREMENTS_LIMIT,
  type Requirement,
  type RequirementErrors,
  type RequirementTier,
} from '@repo/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CircleAlertIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { saveRequirements } from '@/app/actions/jobs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/**
 * The Requirements editor on the Job's Settings tab (spec: .scratch/keyword-match/spec.md, "Web";
 * GLOSSARY.md "Requirement"). A manager adds, edits, reorders and removes Requirements (a description,
 * a tier and the keywords that count as evidence in a CV) and saves the whole list at once
 * (`saveRequirements`: one replace-all). Same state shape as `ScreeningRulesEditor`:
 *
 * `requirements` is the draft list (exactly the payload), `saved` is what the API last confirmed and Save
 * is enabled when they differ, so an unchanged list can't even be sent (and the API would make no version
 * if it were). `errors` holds the refusals by index from the last save; editing a Requirement clears its
 * errors, and removing or moving one clears all of them because the indexes shift. Pure edits (a new
 * Requirement, adding a keyword under the caps, reordering, error grouping) are in `@repo/shared`
 * (`requirement-editor.ts`, tested there). The caps and their messages come from `requirementsSchema`
 * (`saveRequirements` runs it), so the editor has no copy of the rules beyond the counters it shows.
 *
 * Ticket 08 adds the Re-check control next to the Save row; the Requirements' `version` is `savedVersion`.
 */
export function RequirementsEditor({
  companySlug,
  jobSlug,
  savedRequirements,
  savedVersion,
}: {
  companySlug: string;
  jobSlug: string;
  savedRequirements: Requirement[];
  savedVersion: number;
}) {
  const [requirements, setRequirements] = useState(savedRequirements);
  const [saved, setSaved] = useState(savedRequirements);
  const [version, setVersion] = useState(savedVersion);
  const [errors, setErrors] = useState<Record<number, RequirementErrors>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  const dirty = JSON.stringify(requirements) !== JSON.stringify(saved);
  const atLimit = requirements.length >= REQUIREMENTS_LIMIT;

  function edit(index: number, next: Requirement) {
    setRequirements((current) => current.map((item, i) => (i === index ? next : item)));
    setErrors((current) => {
      if (!current[index]) return current;
      const rest = { ...current };
      delete rest[index];
      return rest;
    });
  }

  function remove(index: number) {
    setRequirements((current) => current.filter((_, i) => i !== index));
    // The indexes shift, so the old errors no longer line up.
    setErrors({});
    setFormError(undefined);
  }

  function move(index: number, to: number) {
    setRequirements((current) => moveItem(current, index, to));
    setErrors({});
  }

  function save() {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveRequirements>>;
      try {
        result = await saveRequirements(companySlug, jobSlug, requirements);
      } catch {
        result = { formError: 'Check your connection and try again.' };
      }
      if (result.requirements) {
        setSaved(result.requirements);
        setRequirements(result.requirements);
        setVersion(result.version ?? version);
        setErrors({});
        setFormError(undefined);
        toast.add({ type: 'success', title: 'Requirements saved' });
        return;
      }
      setErrors(result.requirementErrors ?? {});
      setFormError(result.formError);
      toast.add({
        type: 'error',
        title: "Couldn't save the requirements",
        description: result.formError ?? 'Fix the requirements marked below and try again.',
      });
    });
  }

  const motionProps = reduceMotion
    ? {}
    : {
        // Animate UI's panel timings: in 300 ms, out 150 ms, a 12 px shift, `ease.out` (dist/utils/motion).
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] as const } },
        exit: { opacity: 0, y: -12, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as const } },
      };

  return (
    <div className="flex flex-col gap-3" data-requirements-version={version}>
      {requirements.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          No requirements yet. Candidates are not checked against anything.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {requirements.map((requirement, index) => (
              <motion.li key={requirement.id} {...motionProps} className="list-none">
                <RequirementCard
                  requirement={requirement}
                  index={index}
                  count={requirements.length}
                  errors={errors[index]}
                  disabled={pending}
                  onChange={(next) => edit(index, next)}
                  onRemove={() => remove(index)}
                  onMove={(to) => move(index, to)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}

      {formError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={pending || atLimit}
          onClick={() => setRequirements((current) => [...current, newRequirement(crypto.randomUUID())])}
        >
          <PlusIcon data-icon="inline-start" />
          Add requirement
        </Button>
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
          Save requirements
        </Button>
        {dirty && !pending && (
          <Button
            variant="ghost"
            onClick={() => {
              setRequirements(saved);
              setErrors({});
              setFormError(undefined);
            }}
          >
            <XIcon data-icon="inline-start" />
            Discard changes
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {atLimit
          ? `A job can have at most ${REQUIREMENTS_LIMIT} requirements.`
          : `Up to ${REQUIREMENTS_LIMIT} requirements, ${REQUIREMENT_KEYWORDS_LIMIT} keywords each.`}
      </p>
    </div>
  );
}

function RequirementCard({
  requirement,
  index,
  count,
  errors,
  disabled,
  onChange,
  onRemove,
  onMove,
}: {
  requirement: Requirement;
  index: number;
  count: number;
  errors: RequirementErrors | undefined;
  disabled: boolean;
  onChange: (requirement: Requirement) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
}) {
  const id = useId();
  const [draftKeyword, setDraftKeyword] = useState('');
  const [keywordError, setKeywordError] = useState<string | undefined>();
  const label = `Requirement ${index + 1}`;
  const keywordAtLimit = requirement.keywords.length >= REQUIREMENT_KEYWORDS_LIMIT;
  const textMessages = errors?.text ?? [];
  const keywordMessages = [...(errors?.keywords ?? []), ...(keywordError ? [keywordError] : [])];
  const otherMessages = errors?.other ?? [];
  const invalid = textMessages.length + keywordMessages.length + otherMessages.length > 0;

  function submitKeyword() {
    const result = addKeyword(requirement.keywords, draftKeyword);
    if (result.error) {
      setKeywordError(result.error);
      return;
    }
    setKeywordError(undefined);
    setDraftKeyword('');
    onChange({ ...requirement, keywords: result.keywords });
  }

  function setKeyword(at: number, value: string) {
    onChange({
      ...requirement,
      keywords: requirement.keywords.map((keyword, i) => (i === at ? value : keyword)),
    });
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 data-[invalid=true]:border-destructive"
      data-invalid={invalid}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="text-sm font-medium">
          {label}
        </h3>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${label} up`}
            disabled={disabled || index === 0}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${label} down`}
            disabled={disabled || index === count - 1}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDownIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} disabled={disabled} onClick={onRemove}>
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-text`} className="text-muted-foreground">
          What the candidate should have
        </Label>
        <Input
          id={`${id}-text`}
          value={requirement.text}
          maxLength={REQUIREMENT_TEXT_MAX_LENGTH}
          placeholder="For example: 3+ years of TypeScript"
          disabled={disabled}
          aria-invalid={textMessages.length > 0}
          aria-describedby={textMessages.length > 0 ? `${id}-text-errors` : undefined}
          onChange={(event) => onChange({ ...requirement, text: event.target.value })}
        />
        {textMessages.length > 0 && (
          <p id={`${id}-text-errors`} role="alert" className="text-sm text-destructive">
            {textMessages.join(' ')}
          </p>
        )}
      </div>

      <ToggleGroup
        aria-label={`${label} tier`}
        variant="outline"
        spacing={0}
        className="self-start"
        value={[requirement.tier]}
        disabled={disabled}
        onValueChange={(value) => {
          const next = value[0];
          if (next === 'must_have' || next === 'nice_to_have') {
            onChange({ ...requirement, tier: next as RequirementTier });
          }
        }}
      >
        <ToggleGroupItem value="must_have" className="gap-2">
          <CircleAlertIcon />
          Must have
        </ToggleGroupItem>
        <ToggleGroupItem value="nice_to_have" className="gap-2">
          <SparklesIcon />
          Nice to have
        </ToggleGroupItem>
      </ToggleGroup>

      <fieldset
        aria-describedby={`${id}-keywords-help`}
        className="flex min-w-0 flex-col gap-2"
        aria-invalid={keywordMessages.length > 0}
      >
        <legend className="mb-1.5 text-sm font-medium text-muted-foreground">Keywords</legend>
        {requirement.keywords.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {requirement.keywords.map((keyword, at) => (
              // Position is the key: a keyword has no id, and editing one must not remount its box.
              <li key={at} className="flex items-center gap-1.5">
                <Input
                  value={keyword}
                  maxLength={REQUIREMENT_KEYWORD_MAX_LENGTH + 20}
                  disabled={disabled}
                  aria-label={`${label}, keyword ${at + 1}`}
                  onChange={(event) => setKeyword(at, event.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove keyword ${keyword || at + 1} from ${label}`}
                  disabled={disabled}
                  onClick={() =>
                    onChange({ ...requirement, keywords: requirement.keywords.filter((_, i) => i !== at) })
                  }
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            value={draftKeyword}
            disabled={disabled || keywordAtLimit}
            placeholder={keywordAtLimit ? 'Keyword limit reached' : 'Add a keyword'}
            aria-label={`${label}, new keyword`}
            onChange={(event) => {
              setDraftKeyword(event.target.value);
              setKeywordError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitKeyword();
              }
            }}
          />
          <Button
            variant="outline"
            disabled={disabled || keywordAtLimit || draftKeyword.trim() === ''}
            onClick={submitKeyword}
          >
            <PlusIcon data-icon="inline-start" />
            Add
          </Button>
        </div>
        <p id={`${id}-keywords-help`} className="text-sm text-muted-foreground">
          {requirement.keywords.length} of {REQUIREMENT_KEYWORDS_LIMIT} keywords, up to{' '}
          {REQUIREMENT_KEYWORD_MAX_LENGTH} characters each. The requirement counts as found when any one appears in
          the CV as a whole word, in any case; list synonyms you accept, such as &quot;Postgres&quot; and
          &quot;PostgreSQL&quot;.
        </p>
        {keywordMessages.length > 0 && (
          <ul role="alert" className="flex flex-col gap-0.5 text-sm text-destructive">
            {keywordMessages.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        )}
      </fieldset>

      {otherMessages.length > 0 && (
        <ul role="alert" className="flex flex-col gap-0.5 text-sm text-destructive">
          {otherMessages.map((message, i) => (
            <li key={i}>{message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
