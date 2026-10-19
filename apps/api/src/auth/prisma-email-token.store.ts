import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
} from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Keeps email verification and password reset tokens in the
 * `email_tokens` table, so a link survives an API restart. Mirrors
 * PrismaSessionStore. Contract: `EmailTokenStore` in
 * node_modules/@nestjs/authentication/dist/interfaces/email-token-store.interface.d.ts
 * and docs/nestjs/auth.md, "The store contract".
 */
@Injectable()
export class PrismaEmailTokenStore implements EmailTokenStore {
  /**
   * Rows kept past expiry cleanup before the ones expiring first are dropped:
   * a bound on the table even under a flood of sign-ups. Same value as the
   * guide's database stores (docs/nestjs/auth.md, `maxPending`).
   */
  protected readonly maxPending: number = 100_000;

  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ emailTokens: this });
  }

  private get tokens() {
    return this.prisma.db.orm.public.EmailToken;
  }

  async saveEmailToken(record: EmailTokenRecord): Promise<void> {
    await this.tokens.create({
      id: record.id,
      purpose: record.purpose,
      userId: record.userId,
      email: record.email,
      fingerprint: record.fingerprint ?? null,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    });
    await this.trim(record.createdAt);
  }

  /**
   * One `DELETE … RETURNING` (`deleteAll()`), so of two requests using the
   * same link only one gets the row back: a link works exactly once. A token
   * of the other purpose is left in place.
   */
  async consumeEmailToken(id: string, purpose: EmailTokenPurpose): Promise<EmailTokenRecord | undefined> {
    const [row] = await this.tokens.where({ id, purpose }).deleteAll();
    return row ? toRecord(row) : undefined;
  }

  async deleteUserEmailTokens(userId: string, purpose: EmailTokenPurpose): Promise<void> {
    await this.tokens.where({ userId, purpose }).deleteAndCount();
  }

  /** Deletes what expired and, past `maxPending`, what expires first. Times come from the service clock. */
  private async trim(now: Date): Promise<void> {
    await this.tokens.where((token) => token.expiresAt.lte(now)).deleteAndCount();
    const cutoff = await this.tokens
      .select('expiresAt')
      .orderBy((token) => token.expiresAt.desc())
      .offset(this.maxPending)
      .first();
    if (cutoff) {
      await this.tokens.where((token) => token.expiresAt.lte(cutoff.expiresAt)).deleteAndCount();
    }
  }
}

/** Optional fields come back absent, never null (the contract compares records deep-equal). */
function toRecord(row: {
  id: string;
  purpose: EmailTokenPurpose;
  userId: string;
  email: string;
  fingerprint: string | null;
  createdAt: Date;
  expiresAt: Date;
}): EmailTokenRecord {
  return {
    id: row.id,
    purpose: row.purpose,
    userId: row.userId,
    email: row.email,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    ...(row.fingerprint !== null && { fingerprint: row.fingerprint }),
  };
}
