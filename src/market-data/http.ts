import { checkRateLimit } from '../alerts/rate-limit.js';
import {
  MARKET_DATA_OPERATIONS,
  MAX_QUERY_LENGTH,
  type MarketDataOperation,
} from './allowlist.js';
import { buildReferencePrice, buildSpreadSnapshot } from './service.js';
import type { MarketDataApiResponse } from './types.js';

export interface VercelLikeRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end: () => void;
}

function header(req: VercelLikeRequest, name: string): string {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] || '';
  return typeof raw === 'string' ? raw : '';
}

function clientIp(req: VercelLikeRequest): string {
  const fwd = header(req, 'x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim().slice(0, 64);
  return (req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

function readQuery(req: VercelLikeRequest): URLSearchParams {
  if (req.query && typeof req.query === 'object') {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (v == null) continue;
      sp.set(k, Array.isArray(v) ? String(v[0] ?? '') : String(v));
    }
    return sp;
  }
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    return u.searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function firstParam(sp: URLSearchParams, key: string): string | null {
  const v = sp.get(key);
  return v == null || v === '' ? null : v;
}

export async function handleMarketDataRequest(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5, stale-while-revalidate=10');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Please use GET with a supported operation.' },
    } satisfies MarketDataApiResponse);
    return;
  }

  const rawUrl = req.url || '';
  if (rawUrl.length > MAX_QUERY_LENGTH) {
    res.status(400).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request.' },
    });
    return;
  }

  const ip = clientIp(req);
  const rl = checkRateLimit(`market-data:${ip}`, 60, 60_000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    res.status(429).json({
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    });
    return;
  }

  const sp = readQuery(req);
  const operation = firstParam(sp, 'operation') as MarketDataOperation | null;
  if (!operation || !(MARKET_DATA_OPERATIONS as readonly string[]).includes(operation)) {
    res.status(400).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Unsupported or missing operation.' },
    });
    return;
  }

  // Reject open-proxy style params
  for (const banned of ['url', 'path', 'endpoint', 'proxy', 'target', 'host']) {
    if (sp.has(banned)) {
      res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request.' },
      });
      return;
    }
  }

  try {
    if (operation === 'spread_snapshot') {
      const out = await buildSpreadSnapshot();
      if (!out.ok) {
        res.status(503).json({
          ok: false,
          error: {
            code: 'MARKET_DATA_UNAVAILABLE',
            message: 'Live market data is temporarily unavailable.',
          },
        });
        return;
      }
      res.status(200).json({
        ok: true,
        data: out.data,
        warnings: out.warnings,
        cache_hit: out.cacheHit,
      });
      return;
    }

    // reference_price
    const out = await buildReferencePrice({
      asset: firstParam(sp, 'asset') ?? 'BTC',
      quote: firstParam(sp, 'quote') ?? 'USDT',
      exchange: firstParam(sp, 'exchange') ?? 'Binance',
    });
    if (!out.ok) {
      if (out.category === 'unsupported' || out.category === 'validation') {
        res.status(400).json({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Please check asset, quote and exchange.' },
        });
        return;
      }
      res.status(503).json({
        ok: false,
        error: {
          code: 'MARKET_DATA_UNAVAILABLE',
          message: 'Live market data is temporarily unavailable.',
        },
      });
      return;
    }
    res.status(200).json({
      ok: true,
      data: out.data,
      warnings: out.warnings,
      cache_hit: out.cacheHit,
    });
  } catch {
    res.status(500).json({
      ok: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Live market data is temporarily unavailable.',
      },
    });
  }
}
