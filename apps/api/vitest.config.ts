import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // src/prisma/db.ts builds the Prisma client at import time and rejects an
    // empty URL, so any spec that imports a service (which imports its
    // repository) needs one. Nothing connects until PrismaService.onModuleInit
    // calls db.connect(), which unit specs never run. Setting it here also
    // stops dotenv from loading the real DATABASE_URL (dotenv doesn't override
    // variables that already exist), so a spec can never reach the dev database.
    env: {
      DATABASE_URL: 'postgres://unit-tests:unused@localhost:5432/unused',
    },
  },
});
