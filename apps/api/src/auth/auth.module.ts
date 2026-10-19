import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { SessionAuth } from './session-auth.provider.js';
import { PrismaSessionStore } from './prisma-session.store.js';
import { PrismaEmailTokenStore } from './prisma-email-token.store.js';
import { EmailVerificationController } from './email-verification.controller.js';
import { EmailVerificationMailer } from './email-verification.mailer.js';
import { VerificationService } from './verification.service.js';
import { AccountLinker } from './account-linker.js';
import { OidcController } from './oidc.controller.js';
import { PrismaOidcStateStore } from './prisma-oidc-state.store.js';

@Module({
  imports: [UsersModule],
  controllers: [
    AuthController,
    EmailVerificationController,
    OidcController,
  ],
  providers: [
    SessionAuth,
    CredentialsService,
    PrismaSessionStore,
    PrismaEmailTokenStore,
    EmailVerificationMailer,
    VerificationService,
    AccountLinker,
    PrismaOidcStateStore,
  ],
})
export class AuthModule {}
