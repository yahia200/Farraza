import { NotFoundException } from '@nestjs/common';
import type { AuthorizationService } from '@nestjs/authorization';
import { parseFormFields, type Answers, type FormFields } from '@repo/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MemberRole, Membership } from '../companies/company.js';
import type { FormVersion } from '../forms/form.js';
import type { FormsRepository } from '../forms/forms.repository.js';
import type { JobWithStages } from '../jobs/job.js';
import type { JobsService } from '../jobs/jobs.service.js';
import type { StorageService } from '../storage/storage.service.js';
import type { CardRow, CardRowWithAnswers } from './pipeline.js';
import type { PipelineRepository } from './pipeline.repository.js';
import { PipelineService } from './pipeline.service.js';

// The board (`PipelineService.board`) and its Highlighted answers, through the service. The real
// PipelineService runs against hand-written in-memory fakes (the pattern of pipeline.files.spec.ts).
// The fake repository mirrors the SQL rules that matter here: cards are a job's Applications, newest
// first, and form versions are looked up by id within the job's company and job. It also counts
// what was read, so a spec can say that answers were not read at all. Those rules are checked
// against the real database by hand.

type PublicApi<T> = { [K in keyof T]: T[K] };

interface StoredApplication extends CardRowWithAnswers {
  jobId: string;
}

class InMemoryPipelineRepository implements Pick<
  PublicApi<PipelineRepository>,
  'findCards' | 'findCardsWithAnswers' | 'findFormFields'
> {
  private readonly applications: StoredApplication[] = [];
  private readonly versions = new Map<
    string,
    { companyId: string; jobId: string; fields: FormFields }
  >();
  /** How many times the Applications' answers were read. */
  answerReads = 0;
  /** The ids asked for, per call of `findFormFields`. */
  readonly versionRequests: string[][] = [];

  seedVersion(
    id: string,
    fields: FormFields,
    owner: { companyId: string; jobId: string } = {
      companyId: 'company-1',
      jobId: 'job-1',
    },
  ): void {
    this.versions.set(id, { ...owner, fields });
  }

  seedApplication(row: Partial<StoredApplication> & { id: string }): void {
    this.applications.push({
      jobId: 'job-1',
      stageId: 'stage-applied',
      status: 'active',
      submittedAt: new Date('2026-03-01T00:00:00Z'),
      candidate: { name: row.id, email: `${row.id}@example.com` },
      formVersionId: 'version-1',
      answers: {},
      ...row,
    });
  }

  private ofJob(jobId: string): StoredApplication[] {
    return this.applications
      .filter((a) => a.jobId === jobId)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  async findCards(jobId: string): Promise<CardRow[]> {
    return this.ofJob(jobId).map(
      ({ id, stageId, status, submittedAt, candidate }) => ({
        id,
        stageId,
        status,
        submittedAt,
        candidate,
      }),
    );
  }

  async findCardsWithAnswers(jobId: string): Promise<CardRowWithAnswers[]> {
    this.answerReads += 1;
    return this.ofJob(jobId).map(
      ({
        id,
        stageId,
        status,
        submittedAt,
        candidate,
        formVersionId,
        answers,
      }) => ({
        id,
        stageId,
        status,
        submittedAt,
        candidate,
        formVersionId,
        answers,
      }),
    );
  }

  async findFormFields(
    companyId: string,
    jobId: string,
    versionIds: readonly string[],
  ): Promise<Map<string, FormFields>> {
    this.versionRequests.push([...versionIds]);
    const found = new Map<string, FormFields>();
    for (const id of versionIds) {
      const version = this.versions.get(id);
      if (version?.companyId === companyId && version.jobId === jobId)
        found.set(id, version.fields);
    }
    return found;
  }
}

/** Only the read the board needs: the latest published form of a job. */
class InMemoryFormsRepository implements Pick<
  PublicApi<FormsRepository>,
  'findLatestPublished'
> {
  private readonly latest = new Map<string, FormVersion>();

  setLatestPublished(jobId: string, id: string, fields: FormFields): void {
    this.latest.set(jobId, {
      id,
      version: 1,
      fields,
      cvMode: 'off',
      publishedAt: new Date('2026-01-02T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    });
  }

  async findLatestPublished(jobId: string): Promise<FormVersion | null> {
    return this.latest.get(jobId) ?? null;
  }
}

/** Mirrors JobsService.get: a job is visible only inside its own company, else 404. */
class FakeJobs implements Pick<PublicApi<JobsService>, 'get'> {
  readonly engineer: JobWithStages = {
    id: 'job-1',
    title: 'Engineer',
    slug: 'engineer',
    description: null,
    status: 'open',
    openedAt: null,
    closedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    highlightedQuestionKeys: [],
    stages: [
      {
        id: 'stage-applied',
        name: 'Applied',
        position: 0,
        kind: 'normal',
        publicLabel: 'received',
      },
      {
        id: 'stage-hired',
        name: 'Hired',
        position: 1,
        kind: 'hired',
        publicLabel: 'closed',
      },
    ],
  };

  async get(membership: Membership, jobSlug: string): Promise<JobWithStages> {
    if (membership.company.id === 'company-1' && jobSlug === this.engineer.slug)
      return this.engineer;
    throw new NotFoundException();
  }
}

function member(companyId: string, role: MemberRole): Membership {
  return {
    userId: `user-${role}`,
    role,
    company: {
      id: companyId,
      name: companyId,
      slug: companyId,
      logoUrl: null,
      brandColor: null,
    },
  };
}

/** Parses a form that must be valid, so the fixture can't drift from the real shape. */
function formOf(questions: unknown[]): FormFields {
  const result = parseFormFields(questions);
  if (!result.ok)
    throw new Error(`Test form is invalid: ${JSON.stringify(result.errors)}`);
  return result.fields;
}

/** Question keys and option ids of the test forms. */
const Q = {
  city: '10000000-0000-4000-8000-000000000001',
  level: '10000000-0000-4000-8000-000000000002',
  onSite: '10000000-0000-4000-8000-000000000003',
  cover: '10000000-0000-4000-8000-000000000004',
  sample: '10000000-0000-4000-8000-000000000005',
} as const;
const JUNIOR = '30000000-0000-4000-8000-000000000001';
const SENIOR = '30000000-0000-4000-8000-000000000002';

const base = { helpText: null, required: false };
const city = {
  ...base,
  key: Q.city,
  type: 'short_text',
  label: 'City',
  config: { maxLength: 100 },
};
const level = (
  labels: { junior: string; senior: string },
  label = 'Level',
) => ({
  ...base,
  key: Q.level,
  type: 'single_select',
  label,
  config: {
    options: [
      { id: JUNIOR, label: labels.junior },
      { id: SENIOR, label: labels.senior },
    ],
    rejectOptionIds: [],
  },
});
const onSite = {
  ...base,
  key: Q.onSite,
  type: 'yes_no',
  label: 'On site?',
  config: { rejectWhen: null },
};
const cover = {
  ...base,
  key: Q.cover,
  type: 'long_text',
  label: 'Cover letter',
  config: { maxLength: 5000 },
};
const sample = {
  ...base,
  key: Q.sample,
  type: 'file',
  label: 'Work sample',
  config: { kinds: ['document'], maxSizeMb: 10, maxDurationSeconds: null },
};

describe('the pipeline board', () => {
  let repository: InMemoryPipelineRepository;
  let forms: InMemoryFormsRepository;
  let jobs: FakeJobs;
  let service: PipelineService;

  /** Publishes `fields` as the job's latest form, under version id `id`. */
  function publish(id: string, fields: FormFields): void {
    repository.seedVersion(id, fields);
    forms.setLatestPublished('job-1', id, fields);
  }

  function highlight(...keys: string[]): void {
    jobs.engineer.highlightedQuestionKeys = keys;
  }

  async function cardsOf(role: MemberRole = 'recruiter') {
    const board = await service.board(member('company-1', role), 'engineer');
    return board.columns.flatMap((column) => column.applications);
  }

  beforeEach(() => {
    repository = new InMemoryPipelineRepository();
    forms = new InMemoryFormsRepository();
    jobs = new FakeJobs();
    service = new PipelineService(
      repository as unknown as PipelineRepository,
      jobs as unknown as JobsService,
      { authorize: async () => {} } as unknown as AuthorizationService,
      {} as StorageService,
      forms as unknown as FormsRepository,
    );
  });

  describe('with no Highlighted questions', () => {
    it('sends an empty list, `highlights: {}` on every card, and does not read answers', async () => {
      publish('version-1', formOf([city]));
      repository.seedApplication({
        id: 'mona',
        answers: { [Q.city]: 'Cairo' } satisfies Answers,
      });

      const board = await service.board(
        member('company-1', 'recruiter'),
        'engineer',
      );

      expect(board.highlightedQuestions).toEqual([]);
      expect(
        board.columns
          .flatMap((c) => c.applications)
          .map((card) => card.highlights),
      ).toEqual([{}]);
      expect(repository.answerReads).toBe(0);
      expect(repository.versionRequests).toEqual([]);
    });
  });

  describe('with Highlighted questions', () => {
    it('gives each card only the Highlighted answers, as display text, or null when unanswered', async () => {
      publish(
        'version-1',
        formOf([city, level({ junior: 'Junior', senior: 'Senior' }), onSite]),
      );
      highlight(Q.level, Q.onSite);
      repository.seedApplication({
        id: 'mona',
        answers: { [Q.city]: 'Cairo', [Q.level]: SENIOR, [Q.onSite]: false },
      });
      repository.seedApplication({
        id: 'omar',
        submittedAt: new Date('2026-02-01T00:00:00Z'),
        answers: { [Q.city]: 'Giza' },
      });

      expect(
        (await cardsOf()).map((card) => [card.id, card.highlights]),
      ).toEqual([
        ['mona', { [Q.level]: 'Senior', [Q.onSite]: 'No' }],
        ['omar', { [Q.level]: null, [Q.onSite]: null }],
      ]);
    });

    it('resolves an older Application against its own form version, so it keeps its own option labels', async () => {
      repository.seedVersion(
        'version-1',
        formOf([level({ junior: 'Junior', senior: 'Senior' })]),
      );
      publish(
        'version-2',
        formOf([level({ junior: 'Entry level', senior: 'Experienced' })]),
      );
      highlight(Q.level);
      repository.seedApplication({
        id: 'old',
        formVersionId: 'version-1',
        answers: { [Q.level]: SENIOR },
      });
      repository.seedApplication({
        id: 'new',
        formVersionId: 'version-2',
        submittedAt: new Date('2026-04-01T00:00:00Z'),
        answers: { [Q.level]: SENIOR },
      });

      expect(
        (await cardsOf()).map((card) => [card.id, card.highlights[Q.level]]),
      ).toEqual([
        ['new', 'Experienced'],
        ['old', 'Senior'],
      ]);
    });

    it('gives null to an Application whose form version lacks the Question', async () => {
      repository.seedVersion('version-1', formOf([city]));
      publish('version-2', formOf([city, onSite]));
      highlight(Q.onSite);
      repository.seedApplication({
        id: 'old',
        formVersionId: 'version-1',
        answers: { [Q.city]: 'Cairo' },
      });

      expect((await cardsOf()).map((card) => card.highlights)).toEqual([
        { [Q.onSite]: null },
      ]);
    });

    it("gives null where the Application's own version has the key on a Question that cannot be highlighted", async () => {
      repository.seedVersion(
        'version-1',
        formOf([{ ...sample, key: Q.cover }]),
      );
      publish('version-2', formOf([cover]));
      highlight(Q.cover);
      repository.seedApplication({
        id: 'old',
        formVersionId: 'version-1',
        answers: { [Q.cover]: '40000000-0000-4000-8000-000000000001' },
      });

      expect((await cardsOf()).map((card) => card.highlights)).toEqual([
        { [Q.cover]: null },
      ]);
    });

    it('reads each distinct form version once, not once per Application', async () => {
      repository.seedVersion('version-1', formOf([city]));
      publish('version-2', formOf([city]));
      highlight(Q.city);
      repository.seedApplication({ id: 'a', formVersionId: 'version-1' });
      repository.seedApplication({ id: 'b', formVersionId: 'version-2' });
      repository.seedApplication({ id: 'c', formVersionId: 'version-1' });

      await cardsOf();

      expect(repository.versionRequests).toHaveLength(1);
      expect([...repository.versionRequests[0]!].sort()).toEqual([
        'version-1',
        'version-2',
      ]);
    });

    it('leaves a stored key the latest published form no longer has out of the list and every card', async () => {
      repository.seedVersion('version-1', formOf([city, onSite]));
      publish('version-2', formOf([city]));
      highlight(Q.city, Q.onSite);
      repository.seedApplication({
        id: 'old',
        formVersionId: 'version-1',
        answers: { [Q.city]: 'Cairo', [Q.onSite]: true },
      });

      const board = await service.board(
        member('company-1', 'recruiter'),
        'engineer',
      );

      expect(board.highlightedQuestions).toEqual([
        { key: Q.city, label: 'City' },
      ]);
      expect(
        board.columns
          .flatMap((c) => c.applications)
          .map((card) => card.highlights),
      ).toEqual([{ [Q.city]: 'Cairo' }]);
    });

    it('leaves out a stored key that the latest published form has on a Question that cannot be highlighted', async () => {
      publish('version-1', formOf([city, sample]));
      highlight(Q.city, Q.sample);
      repository.seedApplication({
        id: 'mona',
        answers: { [Q.city]: 'Cairo' },
      });

      const board = await service.board(
        member('company-1', 'recruiter'),
        'engineer',
      );

      expect(
        board.highlightedQuestions.map((question) => question.key),
      ).toEqual([Q.city]);
      expect(
        board.columns
          .flatMap((c) => c.applications)
          .map((card) => card.highlights),
      ).toEqual([{ [Q.city]: 'Cairo' }]);
    });

    it('does not read answers when every stored key is stale', async () => {
      publish('version-2', formOf([city]));
      highlight(Q.onSite);
      repository.seedApplication({
        id: 'mona',
        answers: { [Q.city]: 'Cairo' },
      });

      const board = await service.board(
        member('company-1', 'recruiter'),
        'engineer',
      );

      expect(board.highlightedQuestions).toEqual([]);
      expect(
        board.columns
          .flatMap((c) => c.applications)
          .map((card) => card.highlights),
      ).toEqual([{}]);
      expect(repository.answerReads).toBe(0);
    });

    it('lists the Highlighted questions in form order with the latest text, whatever order they were stored in', async () => {
      repository.seedVersion(
        'version-1',
        formOf([city, level({ junior: 'Junior', senior: 'Senior' }), onSite]),
      );
      publish(
        'version-2',
        formOf([
          onSite,
          city,
          level({ junior: 'Junior', senior: 'Senior' }, 'Seniority'),
        ]),
      );
      highlight(Q.level, Q.city, Q.onSite);

      const board = await service.board(
        member('company-1', 'recruiter'),
        'engineer',
      );

      expect(board.highlightedQuestions).toEqual([
        { key: Q.onSite, label: 'On site?' },
        { key: Q.city, label: 'City' },
        { key: Q.level, label: 'Seniority' },
      ]);
    });

    it('does not read a form version of another job or company, so the answer reads as null', async () => {
      publish('version-1', formOf([city]));
      repository.seedVersion('other-job-version', formOf([city]), {
        companyId: 'company-1',
        jobId: 'job-2',
      });
      repository.seedVersion('other-company-version', formOf([city]), {
        companyId: 'company-2',
        jobId: 'job-1',
      });
      highlight(Q.city);
      repository.seedApplication({
        id: 'other-job',
        formVersionId: 'other-job-version',
        answers: { [Q.city]: 'Cairo' },
      });
      repository.seedApplication({
        id: 'other-company',
        formVersionId: 'other-company-version',
        submittedAt: new Date('2026-02-01T00:00:00Z'),
        answers: { [Q.city]: 'Giza' },
      });

      expect(
        (await cardsOf()).map((card) => [card.id, card.highlights]),
      ).toEqual([
        ['other-job', { [Q.city]: null }],
        ['other-company', { [Q.city]: null }],
      ]);
    });

    it('cuts long text at 200 characters', async () => {
      publish('version-1', formOf([cover]));
      highlight(Q.cover);
      repository.seedApplication({
        id: 'mona',
        answers: { [Q.cover]: 'a'.repeat(250) },
      });

      const [card] = await cardsOf();

      expect(card!.highlights[Q.cover]).toBe(`${'a'.repeat(200)}…`);
    });
  });

  describe('access', () => {
    it("answers 404 for another company's job", async () => {
      publish('version-1', formOf([city]));
      highlight(Q.city);

      await expect(
        service.board(member('company-2', 'owner'), 'engineer'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.answerReads).toBe(0);
    });

    it('lets an interviewer read the board with its Highlighted answers', async () => {
      publish('version-1', formOf([city]));
      highlight(Q.city);
      repository.seedApplication({
        id: 'mona',
        answers: { [Q.city]: 'Cairo' },
      });

      expect(
        (await cardsOf('interviewer')).map((card) => card.highlights),
      ).toEqual([{ [Q.city]: 'Cairo' }]);
    });
  });
});
