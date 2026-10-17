import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/net-profit/**/*.test.ts',
      'src/alerts/**/*.test.ts',
      'src/route-validator/**/*.test.ts',
      'src/market-data/**/*.test.ts',
      'src/analytics/**/*.test.ts',
      'src/funnel/**/*.test.ts',
    ],
    environment: 'node',
  },
});
