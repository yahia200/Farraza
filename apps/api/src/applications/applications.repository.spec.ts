import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ApplicationsRepository } from './applications.repository.js';

// There is no database in unit specs (see vitest.config.ts), so this does not run SQL. It records
// what the repository asks the ORM for and pins the one filter the closed-job rule rests on: the
// service specs use a fake repository that is told which jobs are open, so only this proves the
// real query itself asks for `status: 'open'`.

type Where = Record<string, unknown> | ((...args: never[]) => unknown);

/** An ORM table that records every `where` and answers `first()` with a fixed row. */
function recordingTable(row: unknown) {
  const wheres: Where[] = [];
  const table = {
    wheres,
    where: (condition: Where) => {
      wheres.push(condition);
      return table;
    },
    include: () => table,
    orderBy: () => table,
    first: async () => row,
  };
  return table;
}

describe('ApplicationsRepository.findOpenJob', () => {
  it('asks the database for an open job only, in the company named by the slug', async () => {
    const company = recordingTable({ id: 'company-1', slug: 'acme' });
    const job = recordingTable(null); // what the database answers for a closed or draft job
    const prisma = { db: { orm: { public: { Company: company, Job: job } } } };
    const repository = new ApplicationsRepository(prisma as unknown as PrismaService);

    await expect(repository.findOpenJob('acme', 'backend')).resolves.toBeNull();

    expect(company.wheres).toEqual([{ slug: 'acme' }]);
    expect(job.wheres).toEqual([{ companyId: 'company-1', slug: 'backend', status: 'open' }]);
  });
});
