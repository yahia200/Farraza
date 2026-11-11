import { describe, expect, it, vi } from 'vitest';
import type { Queue } from 'bullmq';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

// The Cloud Run startup probe relies on this route failing when a database is unreachable.

function controller({ appDbFails = false, queueFails = false } = {}) {
  const all = appDbFails ? vi.fn().mockRejectedValue(new Error('app db down')) : vi.fn().mockResolvedValue([]);
  const prisma = { db: { orm: { public: { User: { limit: () => ({ all }) } } } } } as unknown as PrismaService;
  const getJobCounts = queueFails
    ? vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND base'))
    : vi.fn().mockResolvedValue({});
  return { health: new HealthController(prisma, { getJobCounts } as unknown as Queue), getJobCounts };
}

describe('GET /api/health', () => {
  it('answers OK when both databases respond', async () => {
    const { health, getJobCounts } = controller();
    await expect(health.getHealth()).resolves.toBe('OK');
    expect(getJobCounts).toHaveBeenCalledOnce();
  });

  it('fails when the app database is down', async () => {
    await expect(controller({ appDbFails: true }).health.getHealth()).rejects.toThrow('app db down');
  });

  it('fails when the queue database is down, as with a mistyped QUEUE_DATABASE_URL', async () => {
    await expect(controller({ queueFails: true }).health.getHealth()).rejects.toThrow('ENOTFOUND');
  });
});
