import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { createPostgresBackend, setDefaultBackendFactory } from 'bullmq';
import { CompaniesModule } from '../companies/companies.module.js';
import { JobPolicy } from '../jobs/job.policy.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { RECHECK_QUEUE } from './recheck.constants.js';
import { RecheckController } from './recheck.controller.js';
import { RecheckProcessor } from './recheck.processor.js';
import { RecheckRepository } from './recheck.repository.js';
import { RecheckService } from './recheck.service.js';

// BullMQ on our own Postgres (ADR-0007). @nestjs/bullmq builds every Queue and
// Worker with `new Queue(name, options)` and has no backendFactory option, so
// the Postgres backend is selected process-wide with setDefaultBackendFactory
// (node_modules/bullmq/dist/esm/utils/create-backend.d.ts). `migrate: true`
// makes BullMQ create and migrate its `bullmq` schema at boot; the default only
// checks it (node_modules/bullmq/dist/esm/postgres/postgres-connection.d.ts).
@Module({
  imports: [
    CompaniesModule,
    JobsModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        setDefaultBackendFactory(createPostgresBackend);
        return {
          connection: { connectionString: config.getOrThrow<string>('DATABASE_URL'), migrate: true },
        } as never;
      },
    }),
    BullModule.registerQueue({ name: RECHECK_QUEUE }),
  ],
  controllers: [RecheckController],
  providers: [RecheckService, RecheckRepository, RecheckProcessor, JobPolicy],
})
export class RecheckModule {}
