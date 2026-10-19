import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { SessionAuth } from './session-auth.provider.js';
import { PrismaSessionStore } from './prisma-session.store.js';
import { PrismaEmailTokenStore } from './prisma-email-token.store.js';

@Module({
  imports: [UsersModule],
  controllers: [
    AuthController,
  ],
  providers: [
    SessionAuth,
    CredentialsService,
    PrismaSessionStore,
    PrismaEmailTokenStore,
  ],
})
export class AuthModule {}