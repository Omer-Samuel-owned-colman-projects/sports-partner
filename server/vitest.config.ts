import { defineConfig } from 'vitest/config';

process.env.JWT_SECRET = 'test-secret-key';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['src/__tests__/setup.ts'],
  },
});
