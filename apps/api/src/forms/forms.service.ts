import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { parseFormFields, type CvMode, type FormFields, type ScreeningRule } from '@repo/shared';
import type { Membership } from '../companies/company.js';
import { JobPolicy } from '../jobs/job.policy.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { User } from '../users/user.js';
import type { FormVersion, JobForm } from './form.js';
import { FormsRepository } from './forms.repository.js';
import { isUniqueViolation } from '../common/db-errors.js';

@Injectable()
export class FormsService {
  constructor(
    private readonly forms: FormsRepository,
    private readonly jobs: JobsService,
    private readonly authorization: AuthorizationService,
  ) {}

  async get(membership: Membership, jobSlug: string): Promise<JobForm> {
    const job = await this.jobs.get(membership, jobSlug);
    const [draft, published] = await Promise.all([
      this.forms.findDraft(job.id),
      this.forms.findLatestPublished(job.id),
    ]);
    return { draft, published };
  }

  async saveDraft(
    user: User,
    membership: Membership,
    jobSlug: string,
    input: { fields: unknown; cvMode: CvMode },
  ): Promise<FormVersion> {
    await this.authorization.authorize(JobPolicy, 'update', user, membership);

    const parsed = parseFormFields(input.fields);
    if (!parsed.ok) {
      throw new BadRequestException({
        message: 'Some questions in this form need attention.',
        errors: parsed.errors,
      });
    }

    const job = await this.jobs.get(membership, jobSlug);
    const draft = await this.forms.findDraft(job.id);

    if (draft) {
      const updated = await this.forms.updateDraft(draft.id, {
        fields: parsed.fields,
        cvMode: input.cvMode,
      });
      if (!updated) {
        throw new ConflictException('This draft was just published. Reload and try again.');
      }
      return updated;
    }

    const published = await this.forms.findLatestPublished(job.id);
    try {
      return await this.forms.createDraft({
        companyId: membership.company.id,
        jobId: job.id,
        version: (published?.version ?? 0) + 1,
        fields: parsed.fields,
        cvMode: input.cvMode,
        createdById: user.id,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Someone else just started a draft. Reload and try again.');
      }
      throw error;
    }
  }

  async publish(user: User, membership: Membership, jobSlug: string): Promise<FormVersion> {
    await this.authorization.authorize(JobPolicy, 'update', user, membership);

    const job = await this.jobs.get(membership, jobSlug);
    const draft = await this.forms.findDraft(job.id);
    if (!draft) {
      throw new ConflictException('There is no draft to publish.');
    }

    // Saving a draft is never blocked by a rule; publishing is, so a rule never points at nothing.
    const previous = await this.forms.findLatestPublished(job.id);
    const broken = this.brokenScreeningRules(job.screeningRules, draft.fields, previous?.fields ?? []);
    if (broken.length > 0) {
      throw new BadRequestException({
        message:
          'This form can’t be published while a screening rule depends on a question you changed. Edit or remove the rule first.',
        errors: broken,
      });
    }

    const published = await this.forms.publish(draft.id, new Date());
    if (!published) {
      throw new ConflictException('This draft was already published.');
    }
    return published;
  }

  /**
   * Field errors for each Screening rule the new version would leave pointing at nothing: its
   * question is gone or changed type (reported at `screeningRules.<i>.questionKey`), or an option it
   * uses is gone (`screeningRules.<i>.condition.optionIds.<j>`). Labels and order never matter. The
   * question's name comes from the draft, or from the previous published version when it was dropped.
   */
  private brokenScreeningRules(
    rules: readonly ScreeningRule[],
    next: FormFields,
    previous: FormFields,
  ): Array<{ path: string; message: string }> {
    const nextByKey = new Map(next.map((field) => [field.key, field]));
    const previousByKey = new Map(previous.map((field) => [field.key, field]));
    const errors: Array<{ path: string; message: string }> = [];

    rules.forEach((rule, index) => {
      const field = nextByKey.get(rule.questionKey);
      const label = (field ?? previousByKey.get(rule.questionKey))?.label ?? 'a question';
      const prefix = `screeningRules.${index}`;
      const rulePhrase = `The ${rule.outcome === 'reject' ? 'rejecting' : 'flagging'} screening rule about “${label}”`;

      if (field === undefined) {
        errors.push({
          path: `${prefix}.questionKey`,
          message: `${rulePhrase} needs this question, which is no longer on the form. Remove the rule or keep the question.`,
        });
      } else if (field.type !== rule.condition.type) {
        errors.push({
          path: `${prefix}.questionKey`,
          message: `${rulePhrase} was written for a different type of question than “${label}” is now. Remove the rule or restore the question type.`,
        });
      } else if (
        (field.type === 'single_select' || field.type === 'multi_select') &&
        (rule.condition.type === 'single_select' || rule.condition.type === 'multi_select')
      ) {
        const known = new Map(field.config.options.map((option) => [option.id, option.label]));
        const old = previousByKey.get(rule.questionKey);
        const oldOptions =
          old && (old.type === 'single_select' || old.type === 'multi_select') ? old.config.options : [];
        rule.condition.optionIds.forEach((optionId, j) => {
          if (known.has(optionId)) return;
          const optionLabel = oldOptions.find((option) => option.id === optionId)?.label ?? 'an option';
          errors.push({
            path: `${prefix}.condition.optionIds.${j}`,
            message: `${rulePhrase} uses the option “${optionLabel}”, which is no longer on the question. Update or remove the rule.`,
          });
        });
      }
    });
    return errors;
  }
}
