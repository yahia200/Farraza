import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type RefreshTokenRecord,
  type RefreshTokenStore,
} from '@nestjs/authentication';
import { param } from '@prisma/orm-postgres/relational-core/expression';
import { PrismaService } from '../prisma/prisma.service.js';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
type JsonObject = Record<string, unknown>;

/**
 * How long a revocation is kept when the family has no stored token to copy
 * the expiry from. `revokeRefreshTokenFamily()` is given no timestamp, so
 * this one value is measured by the database clock (`now()`). It is
 * housekeeping only, never a security decision, and must stay above the
 * `refreshToken.absoluteTtl` the application configures.
 */
const UNKNOWN_FAMILY_REVOCATION_DAYS = 365;

/**
 * Keeps refresh tokens in `refresh_tokens` and revoked families in
 * `revoked_refresh_families`, so a family survives an API restart. Mirrors
 * PrismaSessionStore. Contract: `RefreshTokenStore` in
 * node_modules/@nestjs/authentication/dist/interfaces/refresh-token-store.interface.d.ts
 * and docs/db-schema.md §3.17 and §3.18.
 */
@Injectable()
export class PrismaRefreshTokenStore implements RefreshTokenStore {
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ refreshTokens: this });
  }

  private get tokens() {
    return this.prisma.db.orm.public.RefreshToken;
  }

  private get revoked() {
    return this.prisma.db.orm.public.RevokedRefreshFamily;
  }

  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const row = await this.tokens.where({ id }).first();
    return row ? toRecord(row) : undefined;
  }

  /**
   * A plain insert (the id is a fresh random token's hash), then housekeeping:
   * drop the tokens of families past their absolute expiry, and with them
   * their revocation, which no longer matters. Times come from the record,
   * which the package took from its clock.
   */
  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    await this.tokens.create({
      id: record.id,
      familyId: record.familyId,
      userId: record.userId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      familyExpiresAt: record.familyExpiresAt,
      usedAt: record.usedAt ?? null,
      claims: (record.claims as JsonValue | undefined) ?? null,
    });
    await this.tokens
      .where((token) => token.familyExpiresAt.lte(record.createdAt))
      .deleteAndCount();
    await this.revoked
      .where((family) => family.expiresAt.lte(record.createdAt))
      .deleteAndCount();
  }

  /**
   * One conditional `UPDATE … WHERE id = ? AND used_at IS NULL`, never a read
   * followed by a write: of several concurrent calls on one token exactly one
   * changes a row and gets `true`; the others are a reuse.
   */
  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    const changed = await this.tokens
      .where({ id })
      .where((token) => token.usedAt.isNull())
      .updateAndCount({ usedAt: at });
    return changed > 0;
  }

  /**
   * Raw SQL because the ORM has no insert with a subselect. The expiry is the
   * family's own when any of its tokens is stored, else a fallback (see
   * UNKNOWN_FAMILY_REVOCATION_DAYS). Always inserts, so a refresh that lost the
   * race to a reuse and saves its successor afterwards finds the family revoked.
   * `ON CONFLICT DO NOTHING` makes it idempotent.
   */
  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    const plan = this.prisma.db.raw.sql`
      INSERT INTO revoked_refresh_families (family_id, expires_at)
      VALUES (
        ${familyId},
        COALESCE(
          (SELECT max(family_expires_at) FROM refresh_tokens WHERE family_id = ${familyId}),
          now() + ${UNKNOWN_FAMILY_REVOCATION_DAYS} * interval '1 day'
        )
      )
      ON CONFLICT (family_id) DO NOTHING
    `
      .affectedCount()
      .build();
    await this.prisma.db.runtime().execute(plan);
  }

  async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    return Boolean(await this.revoked.where({ familyId }).first());
  }

  /**
   * Raw SQL because the ORM has no insert-from-select. Revokes every family the
   * user has tokens in at this moment, in one statement; families started later
   * are not touched.
   */
  async revokeUserRefreshTokens(userId: string): Promise<void> {
    const plan = this.prisma.db.raw.sql`
      INSERT INTO revoked_refresh_families (family_id, expires_at)
      SELECT family_id, max(family_expires_at)
      FROM refresh_tokens
      WHERE user_id = ${param(userId, { codecId: 'pg/uuid@1' })}
      GROUP BY family_id
      ON CONFLICT (family_id) DO NOTHING
    `
      .affectedCount()
      .build();
    await this.prisma.db.runtime().execute(plan);
  }
}

/** Optional fields come back absent, never null (the contract compares records deep-equal). */
function toRecord(row: {
  id: string;
  familyId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  familyExpiresAt: Date;
  usedAt: Date | null;
  claims: unknown;
}): RefreshTokenRecord {
  return {
    id: row.id,
    familyId: row.familyId,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    familyExpiresAt: row.familyExpiresAt,
    ...(row.usedAt !== null && { usedAt: row.usedAt }),
    ...(row.claims != null && { claims: row.claims as JsonObject }),
  };
}
