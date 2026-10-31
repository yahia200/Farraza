/** One fired Screening rule as the sheet shows it. `ruleId` and `reason` are null for old events. */
export interface ShownRule {
  ruleId: string | null;
  questionKey: string;
  questionLabel: string;
  reason: string | null;
}

export interface ScreeningDisplay {
  /** The reject rules that sent the Application to Rejected, from its `auto_rejected` event. */
  rejected: ShownRule[];
  /** The flag rules that fired: the Application's stored flags, else the `flagged` event's rules. */
  flagged: ShownRule[];
}

/** The accessible name of the flag marker, so the count is not left to the icon or the colour. */
export function flagMarkerLabel(count: number): string {
  return `Flagged: ${count} screening ${count === 1 ? 'flag' : 'flags'}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * The rules in an `auto_rejected` or `flagged` event's `data`, in both stored shapes: `{ rules: [...] }`
 * and the older `{ fieldKey, fieldLabel }` of the field-level reject setting. `data` is JSONB, so
 * anything unreadable is skipped.
 */
function rulesOf(data: unknown): ShownRule[] {
  if (!isRecord(data)) return [];
  if (Array.isArray(data.rules)) {
    return data.rules.flatMap((rule): ShownRule[] =>
      isRecord(rule) && typeof rule.questionKey === 'string' && typeof rule.questionLabel === 'string'
        ? [
            {
              ruleId: typeof rule.ruleId === 'string' ? rule.ruleId : null,
              questionKey: rule.questionKey,
              questionLabel: rule.questionLabel,
              reason: typeof rule.reason === 'string' ? rule.reason : null,
            },
          ]
        : [],
    );
  }
  return typeof data.fieldKey === 'string' && typeof data.fieldLabel === 'string'
    ? [{ ruleId: null, questionKey: data.fieldKey, questionLabel: data.fieldLabel, reason: null }]
    : [];
}

/**
 * What the candidate sheet shows about Screening rules: the rules that rejected the Application and
 * the flags it carries. Reasons are the stored text, so a renamed question or an edited rule never
 * changes what is shown.
 */
export function screeningDisplay(
  events: readonly { type: string; data: unknown }[],
  flags: readonly { ruleId: string; questionKey: string; questionLabel: string; reason: string }[],
): ScreeningDisplay {
  const of = (type: string) => events.filter((event) => event.type === type).flatMap((event) => rulesOf(event.data));
  return { rejected: of('auto_rejected'), flagged: flags.length > 0 ? [...flags] : of('flagged') };
}
