/**
 * Throwaway seed for the landing-page pipeline screenshot.
 *
 * Stages a realistic candidate pipeline on the "Farraza" company's
 * "Senior Frontend Engineer" job so the board at
 *   /dashboard/farraza/jobs/senior-frontend-engineer/candidates?view=board
 * photographs well for the hero shot. Not part of the app; safe to delete.
 *
 * Run from apps/api so dotenv picks up DATABASE_URL and the ORM resolves:
 *   node --experimental-strip-types scripts/seed-landing.ts
 *
 * It is re-runnable: it wipes this job's demo applications/candidates first.
 * It writes logo_url directly (the API/schema demand https://, but the board's
 * sidebar <img> happily renders the same-origin dev SVG), and publishes the
 * form + opens the job by setting the columns directly, skipping the services.
 */
import { db } from '../src/prisma/db.ts';

const COMPANY_SLUG = 'farraza';
const JOB_SLUG = 'senior-frontend-engineer';
const LOGO_URL = 'http://localhost:3000/logo-violet.svg';
const BRAND_COLOR = '#4a62e6'; // --primary (public/logo-violet.svg), matches the new theme
const DAY = 24 * 60 * 60 * 1000;

type Seed = {
  name: string;
  email: string;
  phone: string; // E.164, see candidates_phone_format
  stage: string; // must match a default stage name (see below)
  daysAgo: number;
  source?: string | null;
};

// The six default stages, by name (apps/api/src/jobs/job.ts DEFAULT_STAGES):
//   Applied → Screening → Interview → Offer → Hired → Rejected
//
// The roster below is the demo cast and where each person sits in the pipeline.
// It's shaped to tell the "apply → hired, step by step" story at a glance:
// earlier columns weighted, Offer/Hired sparse, plausible names/emails. Status
// is derived from the stage, so you only pick the stage here — edit freely and
// re-run to restage.
const CANDIDATES: Seed[] = [
  { name: 'Nour Hassan', email: 'nour.hassan@example.com', phone: '+201001112233', stage: 'Applied', daysAgo: 1, source: 'linkedin' },
  { name: 'Omar El-Sayed', email: 'omar.elsayed@example.com', phone: '+201004445566', stage: 'Applied', daysAgo: 2 },
  { name: 'Mariam Fouad', email: 'mariam.fouad@example.com', phone: '+201007778899', stage: 'Applied', daysAgo: 3, source: 'referral' },
  { name: 'Youssef Ibrahim', email: 'youssef.ibrahim@example.com', phone: '+201012223344', stage: 'Screening', daysAgo: 5 },
  { name: 'Salma Adel', email: 'salma.adel@example.com', phone: '+201015556677', stage: 'Screening', daysAgo: 6, source: 'indeed' },
  { name: 'Karim Mostafa', email: 'karim.mostafa@example.com', phone: '+201018889900', stage: 'Interview', daysAgo: 8 },
  { name: 'Dina Rashad', email: 'dina.rashad@example.com', phone: '+201021234567', stage: 'Interview', daysAgo: 9, source: 'referral' },
  { name: 'Hana Khalil', email: 'hana.khalil@example.com', phone: '+201027654321', stage: 'Offer', daysAgo: 12 },
  { name: 'Tarek Mahmoud', email: 'tarek.mahmoud@example.com', phone: '+201029998877', stage: 'Hired', daysAgo: 22 },
  { name: 'Laila Samir', email: 'laila.samir@example.com', phone: '+201026665544', stage: 'Rejected', daysAgo: 7 },
];

const statusForKind = (kind: string) =>
  kind === 'hired' ? 'hired' : kind === 'rejected' ? 'rejected' : 'active';

async function main() {
  const company = await db.orm.public.Company.where({ slug: COMPANY_SLUG }).first();
  if (!company) throw new Error(`Company "${COMPANY_SLUG}" not found — create it in the UI first.`);

  const user = await db.orm.public.User.where({ email: 'team@farraza.app' }).first();

  const job = await db.orm.public.Job.where({ companyId: company.id, slug: JOB_SLUG })
    .include('stages')
    .first();
  if (!job) throw new Error(`Job "${JOB_SLUG}" not found — create it in the UI first.`);

  const stages = [...job.stages].sort((a, b) => a.position - b.position);
  const stageByName = new Map(stages.map((s) => [s.name, s]));
  const appliedStage = stageByName.get('Applied')!;

  // 1. Brand the company (logo + color) by writing the columns directly.
  await db.orm.public.Company.where({ id: company.id }).update({
    logoUrl: LOGO_URL,
    brandColor: BRAND_COLOR,
  });

  // 2. Ensure a published form version exists, then open the job.
  let formVersion = await db.orm.public.FormVersion.where({ jobId: job.id })
    .orderBy((v) => v.version.desc())
    .first();
  if (!formVersion) {
    formVersion = await db.orm.public.FormVersion.create({
      companyId: company.id,
      jobId: job.id,
      version: 1,
      fields: [],
      cvMode: 'optional',
      publishedAt: new Date(),
      createdById: user?.id ?? null,
    });
  } else if (!formVersion.publishedAt) {
    formVersion = await db.orm.public.FormVersion.where({ id: formVersion.id }).update({
      publishedAt: new Date(),
    });
  }
  await db.orm.public.Job.where({ id: job.id }).update({
    status: 'open',
    openedAt: new Date(),
    closedAt: null,
  });

  // 3. Wipe any previous demo data for this job so re-runs are clean.
  await db.orm.public.Application.where({ jobId: job.id }).deleteAndCount(); // events cascade
  await db.orm.public.Candidate.where({ companyId: company.id }).deleteAndCount();

  // 4. Create candidates + applications, each placed in its stage.
  for (const seed of CANDIDATES) {
    const stage = stageByName.get(seed.stage);
    if (!stage) throw new Error(`Unknown stage "${seed.stage}" for ${seed.email}`);
    const submittedAt = new Date(Date.now() - seed.daysAgo * DAY);

    await db.transaction(async (tx) => {
      const candidate = await tx.orm.public.Candidate.create({
        companyId: company.id,
        email: seed.email,
        name: seed.name,
        phone: seed.phone,
      });

      const application = await tx.orm.public.Application.create({
        companyId: company.id,
        jobId: job.id,
        candidateId: candidate.id,
        email: seed.email,
        phone: seed.phone,
        formVersionId: formVersion!.id,
        stageId: stage.id,
        status: statusForKind(stage.kind),
        answers: {},
        source: seed.source ?? null,
        submittedAt,
      });

      // 'applied' event for everyone: entered the first stage.
      const events: Array<Record<string, unknown>> = [
        {
          companyId: company.id,
          applicationId: application.id,
          type: 'applied',
          fromStageId: null,
          toStageId: appliedStage.id,
          actorId: null,
          data: seed.source ? { source: seed.source } : {},
        },
      ];
      // A move event for anyone past Applied, so the history is coherent.
      if (stage.id !== appliedStage.id) {
        const type = stage.kind === 'hired' ? 'hired' : stage.kind === 'rejected' ? 'rejected' : 'stage_changed';
        events.push({
          companyId: company.id,
          applicationId: application.id,
          type,
          fromStageId: appliedStage.id,
          toStageId: stage.id,
          actorId: user?.id ?? null,
          data: { fromStageName: appliedStage.name, toStageName: stage.name },
        });
      }
      await tx.orm.public.ApplicationEvent.createAll(events);
    });
  }

  console.log(`Seeded ${CANDIDATES.length} applications into "${job.title}".`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
