import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Each database suite runs its own in-memory Postgres (PGlite); too many at once can exhaust
      // memory on a laptop and crash workers. Four keeps the whole run reliable and fast.
      maxWorkers: 4,
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            include: ['tests/unit/**/*.test.{ts,tsx}'],
            environment: 'jsdom',
            setupFiles: ['tests/unit/setup.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'db',
            include: ['tests/integration/db/**/*.test.ts'],
            environment: 'node',
            testTimeout: 60_000,
            hookTimeout: 60_000,
          },
        },
      ],
    },
  }),
);
