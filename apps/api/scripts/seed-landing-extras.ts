/**
 * Throwaway seed for the landing-page screenshots, run after seed-landing.ts.
 *
 * On the "Farraza" demo company it:
 *   1. gives "Senior Frontend Engineer" a real application form (published v1),
 *   2. fills in answers for the demo applications, so the candidate sheet has content,
 *   3. adds more jobs (open, draft, closed) for the jobs list and the careers page,
 *   4. adds teammates with each role for the members table (no password, can't sign in).
 * Not part of the app; safe to delete. Re-runnable: fixed ids, and existing rows are reused.
 *
 * It writes rows directly, so the cached public pages (careers, apply) catch up
 * after their cache life (`cacheLife('minutes')` in apps/web/lib/public-jobs.ts).
 *
 * Run from apps/api so dotenv picks up DATABASE_URL:
 *   node --experimental-strip-types scripts/seed-landing-extras.ts
 */
import { db } from '../src/prisma/db.ts';
import { DEFAULT_STAGES } from '../src/jobs/job.ts';

const COMPANY_SLUG = 'farraza';
const JOB_SLUG = 'senior-frontend-engineer';
const DAY = 24 * 60 * 60 * 1000;

// Fixed ids so answers point at the right questions and options on every run.
const Q = {
  location: '7d1f2a10-0000-4000-8000-000000000001',
  react: '7d1f2a10-0000-4000-8000-000000000002',
  hours: '7d1f2a10-0000-4000-8000-000000000003',
  shipped: '7d1f2a10-0000-4000-8000-000000000004',
  project: '7d1f2a10-0000-4000-8000-000000000005',
  portfolio: '7d1f2a10-0000-4000-8000-000000000006',
  intro: '7d1f2a10-0000-4000-8000-000000000007',
};
const REACT = {
  junior: '7d1f2a10-0000-4000-8001-000000000001',
  mid: '7d1f2a10-0000-4000-8001-000000000002',
  senior: '7d1f2a10-0000-4000-8001-000000000003',
};
const SHIPPED = {
  appRouter: '7d1f2a10-0000-4000-8002-000000000001',
  rsc: '7d1f2a10-0000-4000-8002-000000000002',
  typescript: '7d1f2a10-0000-4000-8002-000000000003',
  designSystem: '7d1f2a10-0000-4000-8002-000000000004',
  a11y: '7d1f2a10-0000-4000-8002-000000000005',
};

const FIELDS = [
  {
    key: Q.location,
    type: 'short_text',
    label: 'Where are you based?',
    helpText: 'City and country.',
    required: true,
    config: { maxLength: 100 },
  },
  {
    key: Q.react,
    type: 'single_select',
    label: 'How long have you worked with React?',
    helpText: null,
    required: true,
    config: {
      options: [
        { id: REACT.junior, label: 'Less than 2 years' },
        { id: REACT.mid, label: '2 to 4 years' },
        { id: REACT.senior, label: '5 years or more' },
      ],
      rejectOptionIds: [REACT.junior],
    },
  },
  {
    key: Q.hours,
    type: 'yes_no',
    label: 'Can you overlap at least 4 hours a day with Cairo time (UTC+2)?',
    helpText: null,
    required: true,
    config: { rejectWhen: false },
  },
  {
    key: Q.shipped,
    type: 'multi_select',
    label: 'Which of these have you shipped to production?',
    helpText: 'Pick all that apply.',
    required: false,
    config: {
      options: [
        { id: SHIPPED.appRouter, label: 'Next.js App Router' },
        { id: SHIPPED.rsc, label: 'React Server Components' },
        { id: SHIPPED.typescript, label: 'TypeScript at scale' },
        { id: SHIPPED.designSystem, label: 'A design system' },
        { id: SHIPPED.a11y, label: 'Accessibility fixes from an audit' },
      ],
      maxSelections: null,
    },
  },
  {
    key: Q.project,
    type: 'long_text',
    label: 'Tell us about a frontend project you’re proud of.',
    helpText: 'What was hard, and what did you do about it?',
    required: true,
    config: { maxLength: 2000 },
  },
  {
    key: Q.portfolio,
    type: 'short_text',
    label: 'Portfolio or GitHub link',
    helpText: null,
    required: false,
    config: { maxLength: 200 },
  },
  {
    key: Q.intro,
    type: 'file',
    label: 'Record a short video introducing yourself',
    helpText: 'Optional. Your phone camera is fine.',
    required: false,
    config: { kinds: ['video'], maxSizeMb: 100, maxDurationSeconds: 90 },
  },
];

// Answers by candidate email (the cast from seed-landing.ts).
const LOCATIONS = ['Cairo, Egypt', 'Alexandria, Egypt', 'Giza, Egypt', 'Amman, Jordan', 'Dubai, UAE'];
const PROJECTS = [
  'I rebuilt our checkout in Next.js and cut the time to first purchase by a third. The hard part was moving to Server Components without breaking the payment widgets, so I moved one step at a time behind a flag.',
  'I led the design system at a fintech startup: 40 components, documented in Storybook, used by four teams. Getting designers and engineers to agree on tokens took longer than writing the code.',
  'I made a public dashboard usable with a screen reader after an accessibility audit. Most of the work was focus order and live regions, plus teaching the team to test with a keyboard.',
  'I wrote the offline mode for a field-sales app. Syncing conflicts were the tricky bit; we ended up keeping every edit and letting the last one win per field.',
];
const SHIPPED_SETS = [
  [SHIPPED.appRouter, SHIPPED.rsc, SHIPPED.typescript],
  [SHIPPED.typescript, SHIPPED.designSystem],
  [SHIPPED.appRouter, SHIPPED.typescript, SHIPPED.a11y],
  [SHIPPED.rsc, SHIPPED.typescript, SHIPPED.designSystem, SHIPPED.a11y],
];

function answersFor(email: string, index: number, rejected: boolean) {
  const handle = email.split('@')[0]!.replace('.', '');
  return {
    [Q.location]: LOCATIONS[index % LOCATIONS.length],
    // The rejected candidate tripped the knockout question.
    [Q.react]: rejected ? REACT.junior : index % 3 === 0 ? REACT.mid : REACT.senior,
    [Q.hours]: true,
    [Q.shipped]: SHIPPED_SETS[index % SHIPPED_SETS.length],
    [Q.project]: PROJECTS[index % PROJECTS.length],
    ...(index % 2 === 0 ? { [Q.portfolio]: `https://github.com/${handle}` } : {}),
  };
}

const OTHER_JOBS = [
  {
    slug: 'product-designer',
    title: 'Product Designer',
    description: 'Design the flows hiring teams and applicants use every day, from research to polished UI.',
    status: 'open',
    daysAgo: 9,
  },
  {
    slug: 'customer-success-lead',
    title: 'Customer Success Lead',
    description: 'Help small teams get their first hire through Farraza, and bring what they need back to the product.',
    status: 'open',
    daysAgo: 6,
  },
  {
    slug: 'backend-engineer-nodejs',
    title: 'Backend Engineer (Node.js)',
    description: 'Own the API behind the pipeline: NestJS, PostgreSQL and file storage.',
    status: 'open',
    daysAgo: 3,
  },
  {
    slug: 'marketing-intern',
    title: 'Marketing Intern',
    description: 'Three months helping us tell small teams how to hire step by step.',
    status: 'draft',
    daysAgo: 1,
  },
  {
    slug: 'data-analyst',
    title: 'Data Analyst',
    description: 'Turn hiring data into reports our customers actually read.',
    status: 'closed',
    daysAgo: 40,
  },
] as const;

const SIMPLE_FIELDS = [
  {
    key: '7d1f2a10-0000-4000-8003-000000000001',
    type: 'short_text',
    label: 'Where are you based?',
    helpText: null,
    required: true,
    config: { maxLength: 100 },
  },
  {
    key: '7d1f2a10-0000-4000-8003-000000000002',
    type: 'long_text',
    label: 'Why do you want this role?',
    helpText: null,
    required: true,
    config: { maxLength: 2000 },
  },
];

const TEAMMATES = [
  { name: 'Ahmed Zaki', email: 'ahmed.zaki@example.com', role: 'admin' },
  { name: 'Rana Saeed', email: 'rana.saeed@example.com', role: 'recruiter' },
  { name: 'Hossam Nabil', email: 'hossam.nabil@example.com', role: 'interviewer' },
  { name: 'Yara Mansour', email: 'yara.mansour@example.com', role: 'interviewer' },
];

async function main() {
  const company = await db.orm.public.Company.where({ slug: COMPANY_SLUG }).first();
  if (!company) throw new Error(`Company "${COMPANY_SLUG}" not found.`);
  const owner = await db.orm.public.User.where({ email: 'team@farraza.app' }).first();

  // 1. The main job's form: replace the fields of its latest published version.
  const job = await db.orm.public.Job.where({ companyId: company.id, slug: JOB_SLUG }).include('stages').first();
  if (!job) throw new Error(`Job "${JOB_SLUG}" not found — run seed-landing.ts first.`);
  const formVersion = await db.orm.public.FormVersion.where({ jobId: job.id })
    .where((v) => v.publishedAt.isNotNull())
    .orderBy((v) => v.version.desc())
    .first();
  if (!formVersion) throw new Error('No published form — run seed-landing.ts first.');
  await db.orm.public.FormVersion.where({ id: formVersion.id }).update({ fields: FIELDS, cvMode: 'required' });

  // 2. Answers for every demo application on that job.
  const rejectedStage = job.stages.find((s) => s.kind === 'rejected');
  const applications = await db.orm.public.Application.where({ jobId: job.id })
    .orderBy((a) => a.submittedAt.desc())
    .all();
  for (const [index, application] of applications.entries()) {
    await db.orm.public.Application.where({ id: application.id }).update({
      answers: answersFor(application.email, index, application.stageId === rejectedStage?.id),
    });
  }

  // 3. More jobs, each with the default stages and (unless a draft) a published form.
  for (const seed of OTHER_JOBS) {
    const existing = await db.orm.public.Job.where({ companyId: company.id, slug: seed.slug }).first();
    if (existing) continue;
    const createdAt = new Date(Date.now() - seed.daysAgo * DAY);
    await db.transaction(async (tx) => {
      const created = await tx.orm.public.Job.create({
        companyId: company.id,
        title: seed.title,
        slug: seed.slug,
        description: seed.description,
        status: seed.status,
        createdById: owner?.id ?? null,
        openedAt: seed.status === 'draft' ? null : createdAt,
        closedAt: seed.status === 'closed' ? new Date(Date.now() - 5 * DAY) : null,
        createdAt,
      });
      await tx.orm.public.Stage.createAll(
        DEFAULT_STAGES.map((stage) => ({ ...stage, companyId: company.id, jobId: created.id })),
      );
      await tx.orm.public.FormVersion.create({
        companyId: company.id,
        jobId: created.id,
        version: 1,
        fields: SIMPLE_FIELDS,
        cvMode: 'optional',
        publishedAt: seed.status === 'draft' ? null : createdAt,
        createdById: owner?.id ?? null,
      });
    });
  }

  // 4. Teammates with each role.
  for (const mate of TEAMMATES) {
    const user =
      (await db.orm.public.User.where({ email: mate.email }).first()) ??
      (await db.orm.public.User.create({ email: mate.email, name: mate.name, emailVerified: true }));
    await db.orm.public.Membership.upsert({
      create: { companyId: company.id, userId: user.id, role: mate.role },
      update: { role: mate.role },
      conflictOn: { userId: user.id, companyId: company.id },
    });
  }

  console.log(
    `Form: ${FIELDS.length} questions. Answers: ${applications.length} applications. ` +
      `Jobs: ${OTHER_JOBS.length} more. Teammates: ${TEAMMATES.length}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
