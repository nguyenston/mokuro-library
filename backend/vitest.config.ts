import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    testTimeout: 20000,
    env: {
      DATABASE_URL: 'file:./test.db',
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-for-ci',
      COOKIE_SECRET: 'test-cookie-secret-for-ci',
    },
  },
});
