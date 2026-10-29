import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type MfaStore,
  type TotpRecord,
} from '@nestjs/authentication';
import { or } from '@prisma/orm-postgres/orm-client';
import { param } from '@prisma/orm-postgres/relational-core/expression';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Keeps each User's authenticator in `mfa_totp`, recovery code hashes in
 * `mfa_recovery_codes` and failed attempts in `mfa_failures`. Mirrors
 * PrismaSessionStore. Contract: `MfaStore` in
 * node_modules/@nestjs/authentication/dist/interfaces/mfa-store.interface.d.ts
 * and docs/db-schema.md §3.19 to §3.21.
 *
 * `saveTotp()`, `claimTotpStep()`, `consumeRecoveryCode()` and
 * `recordMfaFailure()` are what stop a code being accepted twice or a burst of
 * guesses outrunning the lockout: each is a single atomic write (or, for
 * `recordMfaFailure()`, the three-statement sequence its comment explains),
 * never a read followed by a write.
 */
@Injectable()
export class PrismaMfaStore implements MfaStore {
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ mfa: this });
  }

  private get totp() {
    return this.prisma.db.orm.public.MfaTotp;
  }

  private get codes() {
    return this.prisma.db.orm.public.MfaRecoveryCode;
  }

  private get failures() {
    return this.prisma.db.orm.public.MfaFailure;
  }

  async getTotp(userId: string): Promise<TotpRecord | undefined> {
    const row = await this.totp.where({ userId }).first();
    if (!row) return undefined;
    // Optional fields come back absent, never null.
    return {
      secret: row.secret,
      confirmed: row.confirmed,
      ...(row.pendingSecret !== null && { pendingSecret: row.pendingSecret }),
      ...(row.lastUsedStep !== null && { lastUsedStep: row.lastUsedStep }),
    };
  }

  /**
   * An upsert that never lowers `last_used_step`: the larger of the stored value
   * and the record's wins (`GREATEST` ignores NULLs), so a record read before a
   * concurrent `claimTotpStep()` cannot reopen the step it claimed. Raw SQL
   * because the ORM's upsert update branch takes plain values and cannot
   * express `GREATEST`. `null` removes the authenticator.
   */
  async saveTotp(userId: string, record: TotpRecord | null): Promise<void> {
    if (record === null) {
      await this.totp.where({ userId }).deleteAndCount();
      return;
    }
    const plan = this.prisma.db.raw.sql`
      INSERT INTO mfa_totp (user_id, secret, confirmed, pending_secret, last_used_step)
      VALUES (
        ${param(userId, { codecId: 'pg/uuid@1' })},
        ${record.secret},
        ${record.confirmed},
        ${param(record.pendingSecret ?? null, { codecId: 'pg/text@1' })},
        ${param(record.lastUsedStep ?? null, { codecId: 'pg/int4@1' })}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        secret = EXCLUDED.secret,
        confirmed = EXCLUDED.confirmed,
        pending_secret = EXCLUDED.pending_secret,
        last_used_step = GREATEST(mfa_totp.last_used_step, EXCLUDED.last_used_step)
    `
      .affectedCount()
      .build();
    await this.prisma.db.runtime().execute(plan);
  }

  /**
   * One conditional `UPDATE … WHERE user_id = ? AND (last_used_step IS NULL OR
   * last_used_step < ?)`: of several concurrent calls with the same step exactly
   * one changes a row, so a code works once.
   */
  async claimTotpStep(userId: string, step: number): Promise<boolean> {
    const changed = await this.totp
      .where({ userId })
      .where((totp) =>
        or(totp.lastUsedStep.isNull(), totp.lastUsedStep.lt(step)),
      )
      .updateAndCount({ lastUsedStep: step });
    return changed > 0;
  }

  /**
   * Replaces the set in one transaction, so a reader never sees the old codes
   * half gone. Repeated hashes are collapsed because (user_id, hash) is the
   * primary key. Two simultaneous replacements for one user can still collide
   * on that key (the loser throws); the package only regenerates on request.
   */
  async saveRecoveryCodes(userId: string, hashes: string[]): Promise<void> {
    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.MfaRecoveryCode.where({ userId }).deleteAndCount();
      if (hashes.length > 0) {
        await tx.orm.public.MfaRecoveryCode.createAll(
          [...new Set(hashes)].map((hash) => ({ userId, hash })),
        );
      }
    });
  }

  /** One conditional `DELETE`: of several concurrent calls on one code exactly one removes the row. */
  async consumeRecoveryCode(userId: string, hash: string): Promise<boolean> {
    return (await this.codes.where({ userId, hash }).deleteAndCount()) > 0;
  }

  async countRecoveryCodes(userId: string): Promise<number> {
    const { count } = await this.codes
      .where({ userId })
      .aggregate((aggregate) => ({ count: aggregate.count() }));
    return Number(count);
  }

  /**
   * Records a failed attempt at `now`, then returns the failures inside
   * `windowMs` before `now` (`at > now - windowMs`), this one included.
   *
   * It is deliberately three separate statements, each committed on its own
   * (no transaction): a transaction would hide the new row from parallel
   * callers until it commits, and the contract needs each recorded attempt
   * visible to later callers as soon as this call returns, so that of `n`
   * parallel guesses none sees a count lower than the attempts before it.
   *
   * The prune is global (every user's rows), so users who fail once and never
   * return do not grow the table; that is safe because the application has one
   * configured lockout window. It uses the same cutoff the count does.
   */
  async recordMfaFailure(
    userId: string,
    windowMs: number,
    now: number,
  ): Promise<number> {
    await this.failures.create({ userId, at: new Date(now) });
    await this.failures
      .where((failure) => failure.at.lte(new Date(now - windowMs)))
      .deleteAndCount();
    return await this.countMfaFailures(userId, windowMs, now);
  }

  async countMfaFailures(
    userId: string,
    windowMs: number,
    now: number,
  ): Promise<number> {
    const since = new Date(now - windowMs);
    const { count } = await this.failures
      .where({ userId })
      .where((failure) => failure.at.gt(since))
      .aggregate((aggregate) => ({ count: aggregate.count() }));
    return Number(count);
  }

  async clearMfaFailures(userId: string): Promise<void> {
    await this.failures.where({ userId }).deleteAndCount();
  }
}
