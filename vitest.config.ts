import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/net-profit/**/*.test.ts', 'src/alerts/**/*.test.ts'],
    environment: 'node',
  },
});
