import type { FormattedAnswer, GroupAnswer } from './format-answer';

/**
 * One formatted answer for the sheet: "No answer" when there is none, a bulleted
 * list for several labels, a new-tab link for a URL, plain text otherwise, and for a repeating group a
 * block per Entry. Shared by a top-level question and (as rows) by each Entry.
 */
export function CandidateAnswer({ answer }: { answer: FormattedAnswer }) {
  if (answer === null) {
    return <span className="italic">No answer</span>;
  }
  if (typeof answer === 'object' && !Array.isArray(answer)) {
    if ('href' in answer) {
      return (
        <a
          href={answer.href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-foreground underline underline-offset-4"
        >
          {answer.text}
        </a>
      );
    }
    return <EntryBlocks answer={answer} />;
  }
  if (Array.isArray(answer)) {
    return (
      <ul className="list-inside list-disc">
        {answer.map((label, index) => (
          <li key={index}>{label}</li>
        ))}
      </ul>
    );
  }
  return <p className="whitespace-pre-line text-foreground">{answer}</p>;
}

/**
 * A repeating group's Entries, each its own block of label and answer rows,
 * in the order the applicant gave them. An ordered list, as the order means something.
 */
function EntryBlocks({ answer }: { answer: GroupAnswer }) {
  return (
    <ol className="flex flex-col gap-3">
      {answer.entries.map((rows, index) => (
        <li key={index} className="rounded-lg border bg-muted/30 p-3">
          <dl className="flex flex-col gap-2">
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex flex-col gap-0.5">
                <dt className="text-sm font-medium text-foreground">{row.label}</dt>
                <dd className="text-muted-foreground">
                  <CandidateAnswer answer={row.answer} />
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ol>
  );
}
