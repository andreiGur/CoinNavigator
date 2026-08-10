import { checkRateLimit } from '../alerts/rate-limit.js';
import { validateLiveRoute } from './service.js';
import type { ApiResponse } from './types.js';

const MAX_BODY_BYTES = 8 * 1024;

export interface VercelLikeRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
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

function readBody(
  req: VercelLikeRequest,
): { ok: true; value: unknown } | { ok: false; status: number; response: ApiResponse } {
  if (req.body == null) {
    return {
      ok: false,
      status: 400,
      response: {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Please check the selected route and amount.' },
      },
    };
  }
  if (typeof req.body === 'string') {
    if (req.body.length > MAX_BODY_BYTES) {
      return {
        ok: false,
        status: 413,
        response: {
          ok: false,
          error: { code: 'PAYLOAD_TOO_LARGE', message: 'Please check the selected route and amount.' },
        },
      };
    }
    try {
      return { ok: true, value: JSON.parse(req.body) };
    } catch {
      return {
        ok: false,
        status: 400,
        response: {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Please check the selected route and amount.' },
        },
      };
    }
  }
  const encoded = JSON.stringify(req.body);
  if (encoded.length > MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      response: {
        ok: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Please check the selected route and amount.' },
      },
    };
  }
  return { ok: true, value: req.body };
}

export async function handleRouteValidatorRequest(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Please check the selected route and amount.' },
    });
    return;
  }

  const contentType = header(req, 'content-type').toLowerCase();
  if (!contentType.includes('application/json')) {
    res.status(415).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Please check the selected route and amount.' },
    });
    return;
  }

  const ip = clientIp(req);
  const rl = checkRateLimit(`route-validator:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    res.status(429).json({
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    });
    return;
  }

  const body = readBody(req);
  if (!body.ok) {
    res.status(body.status).json(body.response);
    return;
  }

  try {
    const outcome = await validateLiveRoute(body.value);
    if (!outcome.ok) {
      if (outcome.category === 'validation') {
        res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Please check the selected route and amount.',
          },
        });
        return;
      }
      if (outcome.category === 'unsupported') {
        res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Please check the selected route and amount.',
          },
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

    res.status(200).json({ ok: true, result: outcome.result });
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
