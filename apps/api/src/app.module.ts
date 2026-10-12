import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { CompaniesModule } from './companies/companies.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { FormsModule } from './forms/forms.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, minutes } from '@nestjs/throttler';
import { PipelineModule } from './pipeline/pipeline.module.js';
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }),
  AuthenticationModule.forRoot({ session: { absoluteTtl: '14d', idleTtl: '3d', trustedOrigins: ['http://localhost:3000'] } }),
  AuthorizationModule.forRoot(),
  ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 100 }]),
    HealthModule, PrismaModule, UsersModule, AuthModule, CompaniesModule, JobsModule, FormsModule, ApplicationsModule, PipelineModule],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule { }