import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module.js';
import { FormsRepositoryModule } from '../forms/forms-repository.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { ApplicationPolicy } from './application.policy.js';
import { PipelineController } from './pipeline.controller.js';
import { PipelineRepository } from './pipeline.repository.js';
import { PipelineService } from './pipeline.service.js';

@Module({
  imports: [CompaniesModule, JobsModule, FormsRepositoryModule],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineRepository, ApplicationPolicy],
})
export class PipelineModule {}