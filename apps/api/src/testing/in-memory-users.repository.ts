// An in-memory UsersRepository for service specs (pattern: the fakes in
// src/jobs/jobs.service.spec.ts). It mirrors the real repository's observable
// rules: emails are normalised and unique, and a (provider, subject) identity
// links to at most one user. Test support only: not part of the build (see
// tsconfig.build.json).

import type { User } from '../users/user.js';
import type { UsersRepository } from '../users/users.repository.js';

/** The repository's public surface: a mapped type drops its private `prisma` field. */
type PublicApi<T> = { [K in keyof T]: T[K] };

const normalize = (email: string) => email.trim().normalize('NFC').toLowerCase();

export class InMemoryUsersRepository implements PublicApi<UsersRepository> {
  private readonly users: (User & { passwordHash: string | null })[] = [];
  /** `provider:subject` → user id. */
  private readonly identities = new Map<string, string>();
  private nextId = 1;

  async create(input: {
    email: string;
    name: string;
    passwordHash: string | null;
    emailVerified?: boolean;
  }): Promise<User> {
    const email = normalize(input.email);
    if (this.users.some((user) => user.email === email)) {
      throw new Error('users_email_key: duplicate email (the real table is UNIQUE)');
    }
    const row = {
      id: `user-${this.nextId++}`,
      email,
      emailVerified: input.emailVerified ?? false,
      name: input.name,
      passwordHash: input.passwordHash,
    };
    this.users.push(row);
    return toUser(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = this.users.find((user) => user.id === id);
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = this.users.find((user) => user.email === normalize(email));
    return row ? toUser(row) : null;
  }

  async findCredentials(email: string) {
    const row = this.users.find((user) => user.email === normalize(email));
    return row ? { user: toUser(row), passwordHash: row.passwordHash } : null;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const row = this.users.find((user) => user.id === id);
    if (row) row.passwordHash = passwordHash;
  }

  /** Mirrors the real conditional update: only while `email` is still the user's address. */
  async markEmailVerified(id: string, email: string): Promise<boolean> {
    const row = this.users.find((user) => user.id === id);
    if (!row || row.email !== normalize(email)) return false;
    row.emailVerified = true;
    return true;
  }

  /** Test setup: the user now has another address, not yet verified (the app has no such flow yet). */
  changeEmail(id: string, email: string): void {
    const row = this.users.find((user) => user.id === id);
    if (row) {
      row.email = normalize(email);
      row.emailVerified = false;
    }
  }

  async findByIdentity(provider: string, subject: string): Promise<User | null> {
    const id = this.identities.get(`${provider}:${subject}`);
    return id ? this.findById(id) : null;
  }

  async linkIdentity(userId: string, provider: string, subject: string): Promise<boolean> {
    const key = `${provider}:${subject}`;
    if (this.identities.has(key)) return false;
    this.identities.set(key, userId);
    return true;
  }

  async createWithIdentity(
    input: { email: string; name: string },
    identity: { provider: string; subject: string },
  ): Promise<User | null> {
    if (
      (await this.findByEmail(input.email)) ||
      this.identities.has(`${identity.provider}:${identity.subject}`)
    ) {
      return null;
    }
    const user = await this.create({ ...input, passwordHash: null, emailVerified: true });
    await this.linkIdentity(user.id, identity.provider, identity.subject);
    return user;
  }
}

function toUser(row: User): User {
  return { id: row.id, email: row.email, emailVerified: row.emailVerified, name: row.name };
}
