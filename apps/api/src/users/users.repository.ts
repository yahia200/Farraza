import { Injectable } from '@nestjs/common';
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
}

function toUser(row: { id: string; email: string; emailVerified: boolean; name: string }): User {
  return { id: row.id, email: row.email, emailVerified: row.emailVerified, name: row.name };
}