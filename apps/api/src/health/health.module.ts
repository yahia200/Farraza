import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RECHECK_QUEUE } from '../recheck/recheck.constants.js';
import { HealthController } from './health.controller.js';

@Module({
  // The queue's connection is global (`BullModule.forRootAsync` in RecheckModule); this only
  // gives the controller a handle on the Re-check queue to ask it for its counts.
  imports: [BullModule.registerQueue({ name: RECHECK_QUEUE })],
  controllers: [HealthController],
})
export class HealthModule {}
