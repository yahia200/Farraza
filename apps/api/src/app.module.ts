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
import { join } from 'node:path';
import { FileTemplateEngine, LogMailTransport, MailModule, SmtpTransport } from '@nestjs/mail';
import { oidcOptions } from './auth/oidc.options.js';
@Module({
  // validateEnv stops boot with a list of every missing or malformed variable
  // (src/config/env.schema.ts).
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
  // forRootAsync to read values from the validated config (APP_URL in .env).
  AuthenticationModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      session: { absoluteTtl: '14d', idleTtl: '3d', trustedOrigins: [config.getOrThrow<string>('APP_URL')] },
      // Links in verification emails open the web app's page, which POSTs the token back.
      emailVerification: { url: `${config.getOrThrow<string>('APP_URL')}/verify-email` },
      // Links in reset emails open the web app's page, which POSTs the token
      // and the new password. They work once, for an hour (the default ttl).
      passwordReset: { url: `${config.getOrThrow<string>('APP_URL')}/reset-password` },
      // "Sign in with Google" (src/auth/oidc.options.ts).
      oidc: oidcOptions(config),
    }),
  }),
  // Real email when SMTP_URL is set; otherwise LogMailTransport prints each
  // email (links included) to the log, for development and tests (env.schema.ts
  // refuses to boot in production without SMTP_URL). Bodies are the HTML
  // templates in src/mail/templates (copied to dist by nest-cli.json assets).
  // Docs: node_modules/@nestjs/mail/dist/interfaces/mail-module-options.interface.d.ts,
  // docs/nestjs/auth.md "Verify email addresses".
  MailModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const smtpUrl = config.get<string>('SMTP_URL');
      return {
        transport: smtpUrl ? new SmtpTransport({ url: smtpUrl }) : new LogMailTransport(),
        templates: new FileTemplateEngine({ dir: join(import.meta.dirname, 'mail/templates') }),
        from: config.getOrThrow<string>('MAIL_FROM'),
      };
    },
  }),
  AuthorizationModule.forRoot(),
  ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 100 }]),
    HealthModule, PrismaModule, UsersModule, AuthModule, CompaniesModule, JobsModule, FormsModule, ApplicationsModule, PipelineModule, StorageModule],
  // Counts each visitor (see TrustedClientThrottlerGuard), not the web server.
  providers: [{ provide: APP_GUARD, useClass: TrustedClientThrottlerGuard }]
})
export class AppModule { }