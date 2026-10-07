import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthenticationModule } from '@nestjs/authentication';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthenticationModule.forRoot({session: { absoluteTtl: '14d', idleTtl: '3d', trustedOrigins: ['http://localhost:3000'] } }), HealthModule, PrismaModule, UsersModule, AuthModule],
})
export class AppModule {}