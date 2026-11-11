import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { RECHECK_QUEUE } from '../recheck/recheck.constants.js';
import { Public } from '@nestjs/authentication';

/**
 * The Cloud Run startup probe (docs/deploy.md) calls this before a new revision gets traffic, so
 * it must fail when anything the API needs to work is unreachable. Both databases are asked: the
 * app's (through Prisma) and the background queue's (`QUEUE_DATABASE_URL`, which can be a
 * different connection from the app's behind a pooler). An error is left to propagate: Nest
 * answers 500, which fails the probe.
 */
@Public()
@Controller('health')
export class HealthController {
    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue(RECHECK_QUEUE) private readonly queue: Queue,
    ) {}

    @Get()
    async getHealth() {
        await this.prisma.db.orm.public.User.limit(1).all();
        await this.queue.getJobCounts();
        return 'OK';
    }
}
