import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { ThrottlerModule, minutes } from '@nestjs/throttler';
import { TrustedClientThrottlerGuard } from './common/trusted-client-throttler.guard.js';
import { PipelineModule } from './pipeline/pipeline.module.js';
import { StorageModule } from './storage/storage.module.js';
import { validateEnv } from './config/env.schema.js';
import { oidcOptions } from './auth/oidc.options.js';
@Module({
  // validateEnv stops boot with a list of every missing or malformed variable
  // (src/config/env.schema.ts).
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
  // forRootAsync to read values from the validated config (APP_URL in .env).
  AuthenticationModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      session: { absoluteTtl: '14d', idleTtl: '3d', trustedOrigins: [config.getOrThrow<string>('APP_URL'), "http://192.168.1.100:3000"] },
      // "Sign in with Google" (src/auth/oidc.options.ts).
      oidc: oidcOptions(config),
    }),
  }),
  AuthorizationModule.forRoot(),
  ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 100 }]),
    HealthModule, PrismaModule, UsersModule, AuthModule, CompaniesModule, JobsModule, FormsModule, ApplicationsModule, PipelineModule, StorageModule],
  // Counts each visitor (see TrustedClientThrottlerGuard), not the web server.
  providers: [{ provide: APP_GUARD, useClass: TrustedClientThrottlerGuard }]
})
export class AppModule { }