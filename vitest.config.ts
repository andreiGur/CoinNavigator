import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/net-profit/**/*.test.ts'],
    environment: 'node',
  },
});
