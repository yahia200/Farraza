import { Module } from '@nestjs/common';
import { FormsRepository } from './forms.repository.js';

/**
 * Owns FormsRepository so the modules that only read form versions (jobs, pipeline) can import it
 * without importing FormsModule. FormsModule imports JobsModule, so JobsModule importing it back
 * would be a circular module import.
 */
@Module({
  providers: [FormsRepository],
  exports: [FormsRepository],
})
export class FormsRepositoryModule {}
