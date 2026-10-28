import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module.js';
import { FormsRepository } from '../forms/forms.repository.js';
import { JobPolicy } from './job.policy.js';
import { JobsController } from './jobs.controller.js';
import { JobsRepository } from './jobs.repository.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [CompaniesModule],
  controllers: [JobsController],
  // FormsRepository is listed here, not imported from FormsModule: FormsModule already imports
  // JobsModule, so importing it back would be a circular module import. The repository is
  // stateless (it only wraps the global PrismaService), so a second instance is harmless.
  providers: [JobsService, JobsRepository, FormsRepository, JobPolicy],
  exports: [JobsService]
})
export class JobsModule {}