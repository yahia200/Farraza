import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { CompaniesModule } from './companies/companies.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }),
  AuthenticationModule.forRoot({ session: { absoluteTtl: '14d', idleTtl: '3d', trustedOrigins: ['http://localhost:3000'] } }),
  AuthorizationModule.forRoot(),
    HealthModule, PrismaModule, UsersModule, AuthModule, CompaniesModule],
})
export class AppModule { }