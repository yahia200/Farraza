import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { SessionAuth } from './session-auth.provider.js';
import { PrismaSessionStore } from './prisma-session.store.js';
import { PrismaEmailTokenStore } from './prisma-email-token.store.js';
import { PrismaRefreshTokenStore } from './prisma-refresh-token.store.js';
import { PrismaMfaStore } from './prisma-mfa.store.js';
import { EmailVerificationController } from './email-verification.controller.js';
import { EmailVerificationMailer } from './email-verification.mailer.js';
import { VerificationService } from './verification.service.js';
import { AccountLinker } from './account-linker.js';
import { OidcController } from './oidc.controller.js';
import { PrismaOidcStateStore } from './prisma-oidc-state.store.js';
import { PasswordResetController } from './password-reset.controller.js';
import { PasswordResetMailer } from './password-reset.mailer.js';
import { PasswordRecoveryService } from './password-recovery.service.js';

@Module({
  imports: [UsersModule],
  controllers: [
    AuthController,
    EmailVerificationController,
    OidcController,
    PasswordResetController,
  ],
  providers: [
    SessionAuth,
    CredentialsService,
    PrismaSessionStore,
    PrismaEmailTokenStore,
    PrismaRefreshTokenStore,
    PrismaMfaStore,
    EmailVerificationMailer,
    VerificationService,
    AccountLinker,
    PrismaOidcStateStore,
    PasswordResetMailer,
    PasswordRecoveryService,
  ],
})
export class AuthModule {}
