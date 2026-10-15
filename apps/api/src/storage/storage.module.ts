import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';

// Global so feature services (applications, pipeline) can inject StorageService
// without importing StorageModule, matching the PrismaModule pattern.
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
