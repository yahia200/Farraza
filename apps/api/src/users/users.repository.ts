import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/db-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from './user.js';

const normalize = (email: string) => email.trim().normalize('NFC').toLowerCase();

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get users() {
    return this.prisma.db.orm.public.User;
  }

  async create(input: { email: string; name: string; passwordHash: string | null }): Promise<User> {
    const row = await this.users.create({
      email: normalize(input.email),
      name: input.name,
      passwordHash: input.passwordHash,
    });
    return toUser(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.users.where({ id }).first();
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.users.where({ email: normalize(email) }).first();
    return row ? toUser(row) : null;
  }

  /** For password sign-in only. */
  async findCredentials(email: string) {
    const row = await this.users.where({ email: normalize(email) }).first();
    return row ? { user: toUser(row), passwordHash: row.passwordHash } : null;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.where({ id }).update({ passwordHash });
  }

  // OIDC identities: a (provider, subject) pair linked to one user. Accounts
  // are matched by it, never by email (emails change, subjects don't).

  async findByIdentity(provider: string, subject: string): Promise<User | null> {
    const row = await this.prisma.db.orm.public.Identity.where({ provider, subject })
      .include('user')
      .first();
    return row ? toUser(row.user) : null;
  }

  /** Returns false when the identity is already linked (to anyone). */
  async linkIdentity(userId: string, provider: string, subject: string): Promise<boolean> {
    try {
      await this.prisma.db.orm.public.Identity.create({ userId, provider, subject });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * A new account whose address the provider verified, with no password, linked
   * to the identity in the same transaction. Returns null when the email or the
   * identity was taken meanwhile (a concurrent sign-in).
   */
  async createWithIdentity(
    input: { email: string; name: string },
    identity: { provider: string; subject: string },
  ): Promise<User | null> {
    try {
      return await this.prisma.db.transaction(async (tx) => {
        const row = await tx.orm.public.User.create({
          email: normalize(input.email),
          name: input.name,
          emailVerified: true,
          passwordHash: null,
        });
        await tx.orm.public.Identity.create({ userId: row.id, ...identity });
        return toUser(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return null;
      }
      throw error;
    }
  }
}

function toUser(row: { id: string; email: string; emailVerified: boolean; name: string }): User {
  return { id: row.id, email: row.email, emailVerified: row.emailVerified, name: row.name };
}