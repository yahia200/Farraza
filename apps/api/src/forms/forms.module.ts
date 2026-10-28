import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { FormsController } from './forms.controller.js';
import { FormsRepositoryModule } from './forms-repository.module.js';
import { FormsService } from './forms.service.js';

@Module({
  imports: [CompaniesModule, JobsModule, FormsRepositoryModule],
  controllers: [FormsController],
  providers: [FormsService],
})
export class FormsModule {}