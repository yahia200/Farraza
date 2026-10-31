'use client';

import {
  conditionOps,
  newRule,
  retargetRule,
  SCREENING_RULES_LIMIT,
  screenableFields,
  setConditionOp,
  toggleConditionOption,
  type FormField,
  type FormFields,
  type RuleErrors,
  type ScreeningCondition,
  type ScreeningRule,
} from '@repo/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BanIcon, CheckIcon, FlagIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { saveScreeningRules } from '@/app/actions/jobs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DateConditionEditor, NumberConditionEditor, WordsConditionEditor } from './condition-inputs';

/**
 * The Screening rules editor on the Job's Settings tab (spec: .scratch/screening-rules/spec.md,
 * "Web"; ADR-0005). A manager adds, edits and removes rules about the published form's questions and
 * saves the whole list at once (`saveScreeningRules`: one replace-all).
 *
 * State: `rules` is the draft list (`ScreeningRule[]`, the exact payload), `saved` is what the API last
 * confirmed, and the Save button is enabled when they differ. `errors` holds the API's refusals by rule
 * index from the last save; editing a rule clears that rule's errors. Pure edits (what a new rule starts
 * as, operator wording, option toggling, error grouping) are in `@repo/shared`
 * (`screening-rule-editor.ts`, tested there).
 *
 * To support a new question type: add it to `SCREENABLE_TYPES` and `defaultCondition` in shared, then
 * add a case to `ConditionEditor` below (the number, date and word inputs are in `condition-inputs.tsx`).
 *
 * Wording: a condition describes the ACCEPTABLE answer and the rule fires outside it, so each
 * operator is labelled by when the rule fires ("unless at least one of", "if any of").
 */
export function ScreeningRulesEditor({
  companySlug,
  jobSlug,
  fields,
  savedRules,
}: {
  companySlug: string;
  jobSlug: string;
  /** The latest published form's top-level questions, in form order. */
  fields: FormFields;
  savedRules: ScreeningRule[];
}) {
  const questions = screenableFields(fields);
  const [rules, setRules] = useState(savedRules);
  const [saved, setSaved] = useState(savedRules);
  const [errors, setErrors] = useState<Record<number, RuleErrors>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  const dirty = JSON.stringify(rules) !== JSON.stringify(saved);
  const atLimit = rules.length >= SCREENING_RULES_LIMIT;

  function edit(index: number, next: ScreeningRule) {
    setRules((current) => current.map((rule, i) => (i === index ? next : rule)));
    setErrors((current) => {
      if (!current[index]) return current;
      const rest = { ...current };
      delete rest[index];
      return rest;
    });
  }

  function remove(index: number) {
    setRules((current) => current.filter((_, i) => i !== index));
    // The indexes shift, so the old errors no longer line up.
    setErrors({});
    setFormError(undefined);
  }

  function add(field: FormField) {
    setRules((current) => [...current, newRule(field, crypto.randomUUID())]);
  }

  function save() {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveScreeningRules>>;
      try {
        result = await saveScreeningRules(companySlug, jobSlug, rules);
      } catch {
        result = { formError: 'Check your connection and try again.' };
      }
      if (result.rules) {
        setSaved(result.rules);
        setRules(result.rules);
        setErrors({});
        setFormError(undefined);
        toast.add({ type: 'success', title: 'Screening rules saved' });
        return;
      }
      setErrors(result.ruleErrors ?? {});
      setFormError(result.formError);
      toast.add({
        type: 'error',
        title: "Couldn't save the screening rules",
        description: result.formError ?? 'Fix the rules marked below and try again.',
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
    <div className="flex flex-col gap-3">
      {rules.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          No screening rules yet. Every application goes to the pipeline as it comes in.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {rules.map((rule, index) => (
              <motion.li key={rule.id} {...motionProps} className="list-none">
                <RuleCard
                  rule={rule}
                  index={index}
                  field={fields.find((field) => field.key === rule.questionKey)}
                  questions={questions}
                  errors={errors[index]}
                  disabled={pending}
                  onChange={(next) => edit(index, next)}
                  onRemove={() => remove(index)}
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" disabled={pending || atLimit || questions.length === 0} />}
          >
            <PlusIcon data-icon="inline-start" />
            Add rule
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 max-w-[calc(100vw-2rem)]">
            {questions.map((field) => (
              <DropdownMenuItem key={field.key} onClick={() => add(field)}>
                <span className="min-w-0 truncate">{field.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
          Save rules
        </Button>
        {dirty && !pending && (
          <Button
            variant="ghost"
            onClick={() => {
              setRules(saved);
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
        {questions.length === 0
          ? 'The published form has no questions to set a rule on yet.'
          : atLimit
            ? `A job can have at most ${SCREENING_RULES_LIMIT} screening rules.`
            : 'Several rules can be about the same question.'}
      </p>
    </div>
  );
}

function RuleCard({
  rule,
  index,
  field,
  questions,
  errors,
  disabled,
  onChange,
  onRemove,
}: {
  rule: ScreeningRule;
  index: number;
  /** The rule's question on the published form, or undefined when the form no longer has it. */
  field: FormField | undefined;
  questions: FormField[];
  errors: RuleErrors | undefined;
  disabled: boolean;
  onChange: (rule: ScreeningRule) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const items = questions.map((question) => ({ value: question.key, label: question.label }));
  const ops = conditionOps(rule.condition.type).map(({ op, label }) => ({ value: op, label }));
  const opValue = 'op' in rule.condition ? (rule.condition.op as string) : undefined;
  const messages = [...(errors?.question ?? []), ...(errors?.condition ?? []), ...(errors?.rule ?? [])];

  return (
    <section
      aria-labelledby={`${id}-title`}
      aria-describedby={messages.length > 0 ? `${id}-errors` : undefined}
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 data-[invalid=true]:border-destructive"
      data-invalid={messages.length > 0}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="text-sm font-medium">
          Rule {index + 1}
        </h3>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove rule ${index + 1}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label id={`${id}-question`} className="text-muted-foreground">
          Question
        </Label>
        <Select
          items={items}
          value={field ? field.key : null}
          disabled={disabled}
          onValueChange={(key) => {
            const next = questions.find((question) => question.key === key);
            if (next && next.key !== rule.questionKey) onChange(retargetRule(rule, next));
          }}
        >
          <SelectTrigger aria-labelledby={`${id}-question`} className="w-full sm:max-w-md">
            <SelectValue placeholder="Question no longer on the form" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {field === undefined ? (
        <Alert variant="warning">
          <AlertDescription>
            This rule is about a question that is not on the published form. Pick another question or remove the
            rule.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              aria-label={`Rule ${index + 1} outcome`}
              variant="outline"
              spacing={0}
              value={[rule.outcome]}
              disabled={disabled}
              onValueChange={(value) => {
                const next = value[0];
                if (next === 'reject' || next === 'flag') onChange({ ...rule, outcome: next });
              }}
            >
              <ToggleGroupItem value="reject" className="gap-2">
                <BanIcon />
                Reject
              </ToggleGroupItem>
              <ToggleGroupItem value="flag" className="gap-2">
                <FlagIcon />
                Flag
              </ToggleGroupItem>
            </ToggleGroup>
            <span className="text-sm">the application</span>
            {ops.length > 0 && (
              <Select
                items={ops}
                value={opValue ?? null}
                disabled={disabled}
                onValueChange={(op) => {
                  if (op) onChange({ ...rule, condition: setConditionOp(rule.condition, op) });
                }}
              >
                <SelectTrigger aria-label={`Rule ${index + 1}: when it applies`} className="w-auto min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ops.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <ConditionEditor
            field={field}
            condition={rule.condition}
            disabled={disabled}
            label={`Rule ${index + 1}`}
            onChange={(condition) => onChange({ ...rule, condition })}
          />

          {!field.required && (
            <p className="text-sm text-muted-foreground">
              A skipped answer never fires a rule. This question is optional, so mark it required on the Application
              form if applicants must answer it.
            </p>
          )}
        </>
      )}

      {messages.length > 0 && (
        <ul id={`${id}-errors`} role="alert" className="flex flex-col gap-0.5 text-sm text-destructive">
          {messages.map((message, i) => (
            <li key={i}>{message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The per-type part of a rule: what the answer is compared with. One case per question type. */
function ConditionEditor({
  field,
  condition,
  disabled,
  label,
  onChange,
}: {
  field: FormField;
  condition: ScreeningCondition;
  disabled: boolean;
  label: string;
  onChange: (condition: ScreeningCondition) => void;
}) {
  if (condition.type === 'yes_no') {
    return (
      <ToggleGroup
        aria-label={`${label}: the answer`}
        variant="outline"
        spacing={0}
        className="self-start"
        value={[condition.answer ? 'yes' : 'no']}
        disabled={disabled}
        onValueChange={(value) => {
          const next = value[0];
          if (next) onChange({ type: 'yes_no', answer: next === 'yes' });
        }}
      >
        <ToggleGroupItem value="yes" className="gap-2">
          <CheckIcon />
          Yes
        </ToggleGroupItem>
        <ToggleGroupItem value="no" className="gap-2">
          <XIcon />
          No
        </ToggleGroupItem>
      </ToggleGroup>
    );
  }

  if (condition.type === 'number') {
    return <NumberConditionEditor condition={condition} disabled={disabled} label={label} onChange={onChange} />;
  }

  if (condition.type === 'date') {
    return <DateConditionEditor condition={condition} disabled={disabled} label={label} onChange={onChange} />;
  }

  if (condition.type === 'short_text' || condition.type === 'long_text') {
    return <WordsConditionEditor condition={condition} disabled={disabled} label={label} onChange={onChange} />;
  }

  if ((condition.type === 'single_select' || condition.type === 'multi_select') && 'options' in field.config) {
    const chosen = new Set(condition.optionIds);
    return (
      <fieldset className="flex min-w-0 flex-col gap-1">
        <legend className="sr-only">{label}: options</legend>
        {field.config.options.map((option) => (
          <Label key={option.id} className="min-h-11 py-1 leading-snug font-normal sm:min-h-8">
            <Checkbox
              checked={chosen.has(option.id)}
              disabled={disabled}
              onCheckedChange={(checked) => onChange(toggleConditionOption(condition, field, option.id, checked))}
            />
            <span className="min-w-0 wrap-break-words">{option.label}</span>
          </Label>
        ))}
      </fieldset>
    );
  }

  return null;
}
