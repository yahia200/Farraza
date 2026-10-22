import { Module } from '@nestjs/common';
import { PublicController } from './applications.public.controller.js';
import { PublicCompanyController } from './public-company.controller.js';
import { ApplicationsRepository } from './applications.repository.js';
import { ApplicationsService } from './applications.service.js';

@Module({
    controllers: [PublicCompanyController, PublicController],
    providers: [ApplicationsService, ApplicationsRepository],
})
export class ApplicationsModule {}
