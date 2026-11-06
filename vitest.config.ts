import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
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
