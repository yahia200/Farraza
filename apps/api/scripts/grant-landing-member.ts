/**
 * Throwaway: grant the landing-shot test account membership on the demo
 * company so it can view the pipeline board for the hero screenshot.
 * Not part of the app; safe to delete. Re-runnable (idempotent).
 *
 * Run from apps/api so dotenv picks up DATABASE_URL:
 *   node --experimental-strip-types scripts/grant-landing-member.ts [email] [role]
 */
import { db } from '../src/prisma/db.ts';

const COMPANY_SLUG = 'khatwateen';
const EMAIL = process.argv[2] ?? 'landing-shot@example.com';
const ROLE = process.argv[3] ?? 'admin';

async function main() {
  const company = await db.orm.public.Company.where({ slug: COMPANY_SLUG }).first();
  if (!company) throw new Error(`Company "${COMPANY_SLUG}" not found.`);

  const user = await db.orm.public.User.where({ email: EMAIL }).first();
  if (!user) throw new Error(`User "${EMAIL}" not found — sign it up through the app first.`);

  await db.orm.public.Membership.upsert({
    create: { companyId: company.id, userId: user.id, role: ROLE },
    update: { role: ROLE },
    conflictOn: { userId: user.id, companyId: company.id },
  });

  console.log(`Granted "${EMAIL}" role "${ROLE}" on "${company.name}".`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
