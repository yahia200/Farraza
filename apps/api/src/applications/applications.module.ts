import { Module } from '@nestjs/common';
import { EmbeddingMatchModule } from '../embedding-match/embedding-match.module.js';
import { PublicController } from './applications.public.controller.js';
import { PublicCompanyController } from './public-company.controller.js';
import { ApplicationsRepository } from './applications.repository.js';
import { ApplicationsService } from './applications.service.js';

@Module({
    imports: [EmbeddingMatchModule],
    controllers: [PublicCompanyController, PublicController],
    providers: [ApplicationsService, ApplicationsRepository],
})
export class ApplicationsModule {}
