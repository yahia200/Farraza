import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { FormsController } from './forms.controller.js';
import { FormsRepository } from './forms.repository.js';
import { FormsService } from './forms.service.js';

@Module({
  imports: [CompaniesModule, JobsModule],
  controllers: [FormsController],
  providers: [FormsService, FormsRepository],
})
export class FormsModule {}