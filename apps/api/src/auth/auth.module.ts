import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { SessionAuth } from './session-auth.provider.js';
import { PrismaSessionStore } from './prisma-session.store.js';
import { AccountLinker } from './account-linker.js';
import { OidcController } from './oidc.controller.js';
import { PrismaOidcStateStore } from './prisma-oidc-state.store.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController, OidcController],
  providers: [SessionAuth, CredentialsService, PrismaSessionStore, AccountLinker, PrismaOidcStateStore],
})
export class AuthModule {}
