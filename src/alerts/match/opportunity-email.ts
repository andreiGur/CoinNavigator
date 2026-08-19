import type { QualifiedMatch } from './evaluate.js';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtUsd(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(4)}%`;
}

export interface OpportunityEmailPayload {
  to: string;
  unsubscribeUrl: string;
  ctaUrl: string;
  match: QualifiedMatch;
}

export function buildReturnUrl(
  siteOrigin: string,
  match: QualifiedMatch,
): string {
  const origin = siteOrigin.replace(/\/$/, '');
  const q = new URLSearchParams({
    asset: match.asset,
    buy: match.buyExchange,
    sell: match.sellExchange,
    utm_source: 'alert_email',
    utm_medium: 'email',
    utm_campaign: 'arbitrage_alert',
  });
  return `${origin}/?${q.toString()}`;
}

export function opportunityEmailSubject(match: QualifiedMatch): string {
  return `${match.asset} arbitrage opportunity detected`;
}

export function opportunityEmailText(payload: OpportunityEmailPayload): string {
  const m = payload.match;
  return [
    `${m.asset} arbitrage candidate detected by CoinNavigator.`,
    '',
    `Buy: ${m.buyExchange} @ ${m.buyPrice}`,
    `Sell: ${m.sellExchange} @ ${m.sellPrice}`,
    `Gross spread: ${fmtPct(m.grossSpreadPct)}`,
    `Estimated net profit: ${fmtPct(m.estimatedNetProfitPct)} (${fmtUsd(m.estimatedNetProfitUsd)})`,
    `Trade amount used for this estimate: ${fmtUsd(m.tradeAmountUsd)}`,
    `Market data timestamp: ${m.dataTimestamp}`,
    '',
    'This is an estimate based on a CoinNavigator snapshot, estimated trading fees, and incomplete transfer-cost data.',
    'Withdrawal/network fees were unavailable and were not treated as zero.',
    'Prices, liquidity, fees and transfer availability can change before execution.',
    'This is not financial advice. CoinNavigator does not execute trades.',
    '',
    `Open CoinNavigator and run Validate Live Route: ${payload.ctaUrl}`,
    '',
    `Unsubscribe: ${payload.unsubscribeUrl}`,
  ].join('\n');
}

export function opportunityEmailHtml(payload: OpportunityEmailPayload): string {
  const m = payload.match;
  const rows = [
    ['Asset', m.asset],
    ['Buy exchange', m.buyExchange],
    ['Observed buy price', String(m.buyPrice)],
    ['Sell exchange', m.sellExchange],
    ['Observed sell price', String(m.sellPrice)],
    ['Gross spread', fmtPct(m.grossSpreadPct)],
    ['Estimated net profit %', fmtPct(m.estimatedNetProfitPct)],
    ['Estimated net profit (USD)', fmtUsd(m.estimatedNetProfitUsd)],
    ['Trade amount used', fmtUsd(m.tradeAmountUsd)],
    ['Market data timestamp', m.dataTimestamp],
  ];
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 8px;color:#64748b;">${escapeHtml(String(k))}</td><td style="padding:6px 8px;font-weight:700;">${escapeHtml(String(v))}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.45;color:#0f172a;">
  <h1 style="font-size:18px;">${escapeHtml(m.asset)} arbitrage opportunity detected</h1>
  <p>CoinNavigator found a candidate route that meets your alert thresholds. This is an <strong>estimated</strong> net result, not a promise of profit.</p>
  <table style="border-collapse:collapse;">${table}</table>
  <p style="font-size:13px;color:#475569;">Trading fees are estimates. Withdrawal and network fees were unavailable and were <strong>not</strong> treated as verified zero. Markets can move before you finish transferring and trading. CoinNavigator does not execute trades and this is not financial advice.</p>
  <p><a href="${escapeHtml(payload.ctaUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700;">Open CoinNavigator — Validate Live Route</a></p>
  <p style="font-size:12px;color:#64748b;"><a href="${escapeHtml(payload.unsubscribeUrl)}">Unsubscribe from this alert</a></p>
</body></html>`;
}

export function emailContainsProhibitedLanguage(text: string): boolean {
  return /guaranteed|risk-free|easy money|guaranteed return|guaranteed arbitrage/i.test(
    text,
  );
}
