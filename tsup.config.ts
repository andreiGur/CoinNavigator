import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'net-profit-engine': 'src/net-profit/index.ts',
  },
  format: ['iife'],
  globalName: 'CoinNavigatorNetProfit',
  outDir: 'assets/js',
  target: 'es2019',
  platform: 'browser',
  minify: false,
  sourcemap: false,
  clean: false,
  dts: false,
  outExtension() {
    return { js: '.js' };
  },
  footer: {
    js: 'if (typeof window !== "undefined") { window.CoinNavigatorNetProfit = CoinNavigatorNetProfit; }',
  },
});
