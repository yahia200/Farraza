import { BadRequestException, type StandardSchemaValidationPipeOptions } from '@nestjs/common';
import type { FieldError } from '@repo/shared';

type Issues = Parameters<NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>>[0];

/**
 * `exceptionFactory` for StandardSchemaValidationPipe. Answers 400 with
 * `{ message, errors: [{ path, message }] }`, the same shape FormsService and
 * ApplicationsService already return for invalid forms and answers.
 * Docs: https://docs.nestjs.com/application/validation
 */
export function toValidationException(issues: Issues): BadRequestException {
  const errors: FieldError[] = issues.map((issue) => ({
    // Same path rule as the pipe's own formatIssueMessages(): keys joined by ".".
    path: (issue.path ?? [])
      .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
      .join('.'),
    message: issue.message,
  }));
  return new BadRequestException({ message: 'Some fields need attention.', errors });
}
