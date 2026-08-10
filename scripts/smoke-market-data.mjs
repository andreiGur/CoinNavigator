/**
 * Local production-equivalent smoke for market-data gateway + no browser→exchange.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}`;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const marketMod = await import(pathToFileURL(path.join(root, 'api/market-data/index.js')).href);
const routeMod = await import(pathToFileURL(path.join(root, 'api/route-validator/index.js')).href);
const marketHandler = marketMod.default;
const routeHandler = routeMod.default;

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function createRes(nodeRes) {
  let statusCode = 200;
  const headers = {};
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(k, v) {
      headers[k] = v;
    },
    json(body) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json; charset=utf-8';
      send(nodeRes, statusCode, JSON.stringify(body), headers);
    },
    end() {
      send(nodeRes, statusCode, '', headers);
    },
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', BASE);
  if (url.pathname === '/api/market-data') {
    await marketHandler(
      {
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: Object.fromEntries(url.searchParams.entries()),
        socket: { remoteAddress: req.socket.remoteAddress },
      },
      createRes(res),
    );
    return;
  }
  if (url.pathname === '/api/route-validator') {
    const body = await readBody(req);
    await routeHandler(
      {
        method: req.method,
        headers: req.headers,
        body,
        socket: { remoteAddress: req.socket.remoteAddress },
      },
      createRes(res),
    );
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const filePath = path.join(root, rel);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, 'Not found');
    return;
  }
  const ext = path.extname(filePath);
  send(res, 200, fs.readFileSync(filePath), {
    'Content-Type': mime[ext] || 'application/octet-stream',
  });
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log('SMOKE_SERVER_READY', BASE);

const results = [];
function ok(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const EXCHANGE_HOST =
  /api\.binance\.com|api\.bybit\.com|api\.mexc\.com|www\.okx\.com\/api|api\.kucoin\.com|api\.gateio\.ws/i;

let browser;
try {
  const snap = await fetch(`${BASE}/api/market-data?operation=spread_snapshot`);
  const snapJson = await snap.json();
  ok('API spread_snapshot', snap.ok && snapJson.ok === true, `exchanges=${snapJson.data?.exchanges?.length}`);

  const ref = await fetch(
    `${BASE}/api/market-data?operation=reference_price&asset=BTC&quote=USDT&exchange=Binance`,
  );
  const refJson = await ref.json();
  ok('API reference_price', ref.ok && refJson.ok === true, String(refJson.data?.price));

  const bad = await fetch(`${BASE}/api/market-data?operation=nope`);
  ok('API rejects unknown operation', bad.status === 400);

  const proxy = await fetch(`${BASE}/api/market-data?operation=spread_snapshot&url=https://evil.example`);
  ok('API rejects proxy url param', proxy.status === 400);

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const exchangeHits = [];
  const apiHits = [];
  page.on('request', (req) => {
    const u = req.url();
    if (EXCHANGE_HOST.test(u)) exchangeHits.push(u);
    if (u.includes('/api/market-data')) apiHits.push(u);
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  ok('Homepage loads', (await page.title()).length > 0, await page.title());

  await page.waitForTimeout(2500);
  ok('No browser requests to exchange market APIs', exchangeHits.length === 0, exchangeHits.slice(0, 2).join(' | '));

  // Force live fallback
  await page.evaluate(async () => {
    if (window.CoinNavigatorSpreadEngine) {
      const live = await window.CoinNavigatorSpreadEngine.fetchLiveSpreadFallback(
        window.TARGET_SYMBOLS || [],
      );
      window.__smokeLive = live;
    }
  });
  ok(
    'Live gateway fallback returns payload',
    !!(await page.evaluate(() => window.__smokeLive && window.__smokeLive.symbols)),
  );
  ok(
    'Browser called /api/market-data for live fallback',
    apiHits.some((u) => u.includes('operation=spread_snapshot')),
  );
  ok('Still no exchange API domains from browser', exchangeHits.length === 0);

  // Reference price
  await page.evaluate(async () => {
    window.__smokeRef = await window.CoinNavigatorSpreadEngine.fetchReferencePrice({
      asset: 'BTC',
      quote: 'USDT',
      exchange: 'Binance',
    });
  });
  ok(
    'Reference price via gateway',
    !!(await page.evaluate(() => window.__smokeRef && Number.isFinite(window.__smokeRef.price))),
  );
  ok(
    'Browser called reference_price',
    apiHits.some((u) => u.includes('operation=reference_price')),
  );

  // Check Real Profit + Live Route
  await page.evaluate(() => {
    window.CoinNavigatorProfitCalc.open({
      symbol: 'BTCUSDT',
      ticker: 'BTC',
      buyExchange: 'Binance',
      sellExchange: 'Bybit',
      buyPrice: 65000,
      sellPrice: 65100,
      rawSpreadPct: 0.15,
      updatedAt: new Date().toISOString(),
    });
  });
  await page.waitForTimeout(400);
  ok('Check Real Profit opens', (await page.locator('#calc-modal.open').count()) > 0);
  await page.fill('#calc-amount', '100');
  await page.click('#calc-live-validate');
  await page.waitForSelector('#calc-live-panel:not([hidden])', { timeout: 30000 });
  ok('Validate Live Route still works', (await page.locator('#calc-live-verdict').innerText()).length > 2);

  for (const w of [320, 375]) {
    await page.setViewportSize({ width: w, height: 720 });
    const overflow = await page.evaluate(() => {
      const modal = document.querySelector('#calc-modal .modal-card');
      return modal ? modal.scrollWidth > modal.clientWidth + 2 : true;
    });
    ok(`Modal layout @${w}px`, !overflow);
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n--- SMOKE SUMMARY ---');
  console.log(`passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length) process.exitCode = 1;
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.close();
}
