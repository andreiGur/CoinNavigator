import { checkRateLimit } from './rate-limit.js';
import { getEmailAdapter } from './email.js';
import { createAlertSubscription, unsubscribeAlert } from './service.js';
import { SupabaseAlertStorage } from './supabase-storage.js';
import { StorageConfigError } from './storage.js';
import type { AlertStorage } from './storage.js';
import type { ApiResponse } from './types.js';

const MAX_BODY_BYTES = 8 * 1024;

export interface VercelLikeRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  send: (body: string) => void;
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
  const real = header(req, 'x-real-ip');
  if (real) return real.trim().slice(0, 64);
  return (req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

function readBody(req: VercelLikeRequest): { ok: true; value: unknown } | { ok: false; response: ApiResponse; status: number } {
  if (req.body == null) {
    return {
      ok: false,
      status: 400,
      response: {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted details.' },
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
          error: { code: 'PAYLOAD_TOO_LARGE', message: 'Please check the submitted details.' },
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
          error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted details.' },
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
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Please check the submitted details.' },
      },
    };
  }
  return { ok: true, value: req.body };
}

function resolveStorage(env: NodeJS.ProcessEnv, injected?: AlertStorage): AlertStorage {
  if (injected) return injected;
  const supabase = SupabaseAlertStorage.fromEnv(env);
  if (supabase) return supabase;
  throw new StorageConfigError();
}

export async function handleCreateAlertRequest(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
  opts: { env?: NodeJS.ProcessEnv; storage?: AlertStorage } = {},
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
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Please check the submitted details.' },
    });
    return;
  }

  const contentType = header(req, 'content-type').toLowerCase();
  if (!contentType.includes('application/json')) {
    res.status(415).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted details.' },
    });
    return;
  }

  const ip = clientIp(req);
  const rl = checkRateLimit(`alerts:create:${ip}`);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    res.status(429).json({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      },
    });
    return;
  }

  const body = readBody(req);
  if (!body.ok) {
    res.status(body.status).json(body.response);
    return;
  }

  const env = opts.env ?? process.env;
  let storage: AlertStorage;
  try {
    storage = resolveStorage(env, opts.storage);
  } catch {
    res.status(503).json({
      ok: false,
      error: {
        code: 'MISSING_CONFIG',
        message: 'Alert storage is temporarily unavailable.',
      },
    });
    return;
  }

  const payload =
    body.value && typeof body.value === 'object'
      ? {
          ...(body.value as Record<string, unknown>),
          user_agent: header(req, 'user-agent'),
        }
      : body.value;

  const result = await createAlertSubscription(payload, {
    storage,
    email: getEmailAdapter(env),
    siteOrigin: env.ALERTS_SITE_ORIGIN || 'https://coinnavigator.net',
  });

  res.status(result.httpStatus).json(result.response);
}

function unsubscribeHtml(ok: boolean, message: string): string {
  const title = ok ? 'Unsubscribed' : 'Unsubscribe';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${title} | CoinNavigator</title>
  <style>
    body{font-family:Inter,system-ui,sans-serif;background:#0b0f1a;color:#f8fafc;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1.5rem}
    .card{max-width:420px;background:#161b2a;border:1px solid #2d334a;border-radius:18px;padding:1.5rem}
    h1{font-size:1.35rem;margin:0 0 .75rem}
    p{color:#94a3b8;line-height:1.5;margin:0 0 1rem}
    a{color:#818cf8;font-weight:700;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="/">Back to CoinNavigator</a></p>
  </div>
</body>
</html>`;
}

export async function handleUnsubscribeRequest(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
  opts: { env?: NodeJS.ProcessEnv; storage?: AlertStorage } = {},
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Please check the submitted details.' },
    });
    return;
  }

  const ip = clientIp(req);
  const rl = checkRateLimit(`alerts:unsub:${ip}`, 30);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    res.status(429).json({
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    });
    return;
  }

  let token: unknown = req.query?.token;
  if (Array.isArray(token)) token = token[0];
  if (!token && req.method === 'POST') {
    const body = readBody(req);
    if (body.ok && body.value && typeof body.value === 'object') {
      token = (body.value as { token?: unknown }).token;
    }
  }

  const env = opts.env ?? process.env;
  let storage: AlertStorage;
  try {
    storage = resolveStorage(env, opts.storage);
  } catch {
    const accept = header(req, 'accept');
    if (req.method === 'GET' && accept.includes('text/html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(503).send(unsubscribeHtml(false, 'Alert storage is temporarily unavailable.'));
      return;
    }
    res.status(503).json({
      ok: false,
      error: { code: 'MISSING_CONFIG', message: 'Alert storage is temporarily unavailable.' },
    });
    return;
  }

  const result = await unsubscribeAlert(token, storage);
  const accept = header(req, 'accept');
  const wantsHtml = req.method === 'GET' && accept.includes('text/html');

  if (wantsHtml) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (result.response.ok) {
      res
        .status(200)
        .send(
          unsubscribeHtml(
            true,
            'You have been unsubscribed from CoinNavigator opportunity alerts. You will no longer receive these emails.',
          ),
        );
      return;
    }
    res
      .status(result.httpStatus)
      .send(unsubscribeHtml(false, result.response.error.message));
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(result.httpStatus).json(result.response);
}
