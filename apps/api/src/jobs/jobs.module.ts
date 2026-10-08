import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module.js';
import { JobPolicy } from './job.policy.js';
import { JobsController } from './jobs.controller.js';
import { JobsRepository } from './jobs.repository.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [CompaniesModule],
  controllers: [JobsController],
  providers: [JobsService, JobsRepository, JobPolicy],
})
export class JobsModule {}