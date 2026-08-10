/**
 * Browser + API smoke for Live Route Validator (requires network for live exchanges).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitReady(proc) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), 15000);
    proc.stdout.on('data', (buf) => {
      const s = buf.toString();
      process.stdout.write(s);
      if (s.includes('SMOKE_SERVER_READY')) {
        clearTimeout(t);
        resolve();
      }
    });
    proc.stderr.on('data', (buf) => process.stderr.write(buf));
    proc.on('exit', (code) => reject(new Error('server exited ' + code)));
  });
}

async function apiValidate(body) {
  const res = await fetch(`${BASE}/api/route-validator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

const results = [];
function ok(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const server = spawn(process.execPath, ['scripts/smoke-route-validator-server.mjs'], {
  cwd: root,
  env: { ...process.env, SMOKE_PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let browser;
try {
  await waitReady(server);

  // API smokes against live exchanges
  const btc = await apiValidate({
    asset: 'BTC',
    quote: 'USDT',
    buy_exchange: 'Binance',
    sell_exchange: 'Bybit',
    trade_amount_usd: 100,
  });
  ok('API BTC Binance→Bybit $100', btc.status === 200 && btc.json.ok === true, btc.json?.result?.verdict);

  const eth = await apiValidate({
    asset: 'ETH',
    quote: 'USDT',
    buy_exchange: 'Bybit',
    sell_exchange: 'MEXC',
    trade_amount_usd: 1000,
  });
  ok('API ETH Bybit→MEXC $1000', eth.status === 200 && eth.json.ok === true, eth.json?.result?.verdict);

  const sol = await apiValidate({
    asset: 'SOL',
    quote: 'USDT',
    buy_exchange: 'MEXC',
    sell_exchange: 'Binance',
    trade_amount_usd: 5000,
  });
  ok('API SOL MEXC→Binance $5000', sol.status === 200 && sol.json.ok === true, sol.json?.result?.verdict);

  const huge = await apiValidate({
    asset: 'BTC',
    quote: 'USDT',
    buy_exchange: 'Binance',
    sell_exchange: 'Bybit',
    trade_amount_usd: 100000,
  });
  ok(
    'API huge size returns fillability verdict',
    huge.status === 200 &&
      huge.json.ok === true &&
      ['insufficient_liquidity', 'transfer_unverified', 'not_profitable', 'marginal', 'potentially_executable'].includes(
        huge.json.result.verdict,
      ),
    huge.json?.result?.verdict,
  );

  const override = await apiValidate({
    asset: 'BTC',
    quote: 'USDT',
    buy_exchange: 'Binance',
    sell_exchange: 'Bybit',
    trade_amount_usd: 100,
    overrides: { withdrawal_fee_asset: 0.0002 },
  });
  ok(
    'API withdrawal fee override applied',
    override.status === 200 &&
      override.json.ok &&
      override.json.result.transfer_route.withdrawalFeeAsset === 0.0002 &&
      override.json.result.fee_sources.withdrawal_fee_kind !== 'unavailable',
  );

  const bad = await apiValidate({
    asset: 'BTC',
    quote: 'USDT',
    buy_exchange: 'Binance',
    sell_exchange: 'Binance',
    trade_amount_usd: 100,
  });
  ok('API same exchange rejected', bad.status === 400 && bad.json.ok === false);

  const noRaw = JSON.stringify(btc.json);
  ok('API response has no raw order book levels', !noRaw.includes('"bids"') && !noRaw.includes('"asks"'));

  // Browser UI
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  ok('Homepage loads', await page.title().then((t) => t.length > 0), await page.title());

  // Inject opportunity open if no live row button yet
  await page.evaluate(() => {
    if (window.CoinNavigatorProfitCalc) {
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
    }
  });
  await sleep(400);
  ok('Check Real Profit modal opens', await page.locator('#calc-modal.open').count().then((n) => n > 0));
  ok('Validate Live Route button present', await page.locator('#calc-live-validate').count().then((n) => n > 0));
  ok('Snapshot estimate panel available', await page.locator('#calc-result-panel').count().then((n) => n > 0));

  await page.fill('#calc-amount', '100');
  const analytics = [];
  await page.exposeFunction('__smokeTrack', (name, props) => {
    analytics.push({ name, props });
  });
  await page.evaluate(() => {
    window.track = function (name, props) {
      window.__smokeTrack(name, props || {});
    };
  });

  await page.click('#calc-live-validate');
  await page.waitForSelector('#calc-live-panel:not([hidden])', { timeout: 30000 });
  const liveVerdict = await page.locator('#calc-live-verdict').innerText();
  ok('Live validation renders result', liveVerdict.length > 2, liveVerdict);

  await page.click('#calc-live-recheck');
  await page.waitForFunction(() => {
    const loading = document.getElementById('calc-live-loading');
    const panel = document.getElementById('calc-live-panel');
    return loading && loading.hidden && panel && !panel.hidden;
  }, { timeout: 30000 });
  ok('Recheck works', await page.locator('#calc-live-panel:not([hidden])').count().then((n) => n > 0));

  // User override: touch withdrawal fee
  await page.evaluate(() => {
    const adv = document.getElementById('calc-advanced');
    if (adv) adv.open = true;
  });
  await page.fill('#calc-fee-withdraw', '0.0003');
  await page.dispatchEvent('#calc-fee-withdraw', 'input');
  await page.click('#calc-live-validate');
  await page.waitForFunction(() => {
    const loading = document.getElementById('calc-live-loading');
    const panel = document.getElementById('calc-live-panel');
    return loading && loading.hidden && panel && !panel.hidden;
  }, { timeout: 30000 });
  const wdText = await page.locator('#calc-live-wd-fee').innerText();
  ok('User withdrawal override reflected', wdText.includes('0.0003') || /user-provided|estimated/i.test(wdText), wdText);

  ok('Affiliate buttons after live result', await page.locator('#calc-live-aff a[rel*="sponsored"]').count().then((n) => n > 0));

  await page.keyboard.press('Escape');
  await sleep(200);
  ok('Escape closes modal', await page.locator('#calc-modal.open').count().then((n) => n === 0));

  // Mobile widths — modal must not force page overflow
  for (const w of [320, 375]) {
    await page.setViewportSize({ width: w, height: 720 });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.CoinNavigatorProfitCalc.open({
        symbol: 'ETHUSDT',
        ticker: 'ETH',
        buyExchange: 'Bybit',
        sellExchange: 'MEXC',
        buyPrice: 3000,
        sellPrice: 3010,
        rawSpreadPct: 0.3,
        updatedAt: new Date().toISOString(),
      });
    });
    await sleep(300);
    const overflow = await page.evaluate(() => {
      const modal = document.querySelector('#calc-modal .modal-card');
      if (!modal) return true;
      return modal.scrollWidth > modal.clientWidth + 2;
    });
    ok(`Modal no horizontal overflow @${w}px`, !overflow);
  }

  const exactLeak = analytics.some((e) => {
    const s = JSON.stringify(e.props || {});
    return /"amount"\s*:|"net_profit"\s*:|@/.test(s) || /trade_amount_usd/.test(s);
  });
  ok('Analytics exclude exact amount/profit/email', !exactLeak, JSON.stringify(analytics.slice(0, 3)));

  const relevantConsole = consoleErrors.filter((t) => {
    if (/CORS policy|ERR_FAILED|coinnavigator\.net\/(data\/)?spread_data|api\.mexc\.com|api\.kucoin\.com/i.test(t)) {
      return false; // expected on localhost smoke host
    }
    return true;
  });
  ok('No console errors from live validator UI', relevantConsole.length === 0, relevantConsole.join(' | '));

  const failed = results.filter((r) => !r.pass);
  console.log('\n--- SMOKE SUMMARY ---');
  console.log(`passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length) {
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
