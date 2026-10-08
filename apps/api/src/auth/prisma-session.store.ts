import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

@Injectable()
export class PrismaSessionStore implements SessionStore {
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this });
  }

  private get sessions() {
    return this.prisma.db.orm.public.Session;
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const row = await this.sessions.where({ id }).first();
    return row ? toRecord(row) : undefined;
  }

  async createSession(record: SessionRecord): Promise<void> {
    await this.sessions.create({
      id: record.id,
      userId: record.userId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      lastActiveAt: record.lastActiveAt,
      mfa: record.mfa ?? null,
      metadata: record.metadata as JsonValue ?? null,
    });
    // Housekeeping: drop sessions that have already expired.
    await this.sessions
      .where((session) => session.expiresAt.lte(record.createdAt))
      .deleteAndCount();
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    // One conditional statement: a session deleted by a sign-out stays deleted.
    await this.sessions
      .where({ id })
      .where((session) => session.lastActiveAt.lt(lastActiveAt))
      .updateAndCount({ lastActiveAt });
  }

  async deleteSession(id: string): Promise<boolean> {
    return (await this.sessions.where({ id }).deleteAndCount()) > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.sessions.where({ userId }).all();
    return rows.map(toRecord);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.sessions.where({ userId }).deleteAndCount();
  }
}

function toRecord(row: {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
  mfa: 'pending' | 'verified' | null;
  metadata: unknown;
}): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastActiveAt: row.lastActiveAt,
    ...(row.mfa !== null && { mfa: row.mfa }),
    ...(row.metadata != null && { metadata: row.metadata as Record<string, unknown> }),
  };
}