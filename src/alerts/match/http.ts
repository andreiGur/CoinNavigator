import { getEmailAdapter } from '../email.js';
import { runAlertMatcher } from './runner.js';
import { loadSpreadSnapshot } from './snapshot.js';
import { SupabaseAlertStorage } from '../supabase-storage.js';
import { StorageConfigError } from '../storage.js';
import type { MatcherStorage } from '../storage.js';
import type { EmailAdapter } from '../email.js';
import type { SpreadSnapshot } from './opportunities.js';
import type { VercelLikeRequest, VercelLikeResponse } from '../http.js';

function header(req: VercelLikeRequest, name: string): string {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] || '';
  return typeof raw === 'string' ? raw : '';
}

export function authorizeCronRequest(
  req: VercelLikeRequest,
  env: NodeJS.ProcessEnv,
): 'ok' | 'missing_config' | 'unauthorized' {
  const secret = (env.CRON_SECRET || '').trim();
  if (!secret) return 'missing_config';
  const auth = header(req, 'authorization');
  const expected = `Bearer ${secret}`;
  if (auth !== expected) return 'unauthorized';
  return 'ok';
}

function readQueryFlag(req: VercelLikeRequest, key: string): boolean {
  const raw = req.query?.[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null) return false;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function readUrlFlag(req: VercelLikeRequest, key: string): boolean {
  const url = (req as VercelLikeRequest & { url?: string }).url;
  if (!url) return false;
  try {
    const u = new URL(url, 'http://localhost');
    const s = (u.searchParams.get(key) || '').toLowerCase();
    return s === '1' || s === 'true' || s === 'yes';
  } catch {
    return false;
  }
}

export function isDryRunRequest(req: VercelLikeRequest): boolean {
  if (readQueryFlag(req, 'dry_run') || readUrlFlag(req, 'dry_run')) return true;
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    const flag = (req.body as { dry_run?: unknown }).dry_run;
    return flag === true || flag === '1' || flag === 'true';
  }
  return false;
}

export interface HandleMatchOpts {
  env?: NodeJS.ProcessEnv;
  storage?: MatcherStorage;
  email?: EmailAdapter;
  snapshot?: SpreadSnapshot;
  now?: () => Date;
  log?: (entry: Record<string, unknown>) => void;
}

export async function handleMatchRequest(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
  opts: HandleMatchOpts = {},
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Unauthorized.' },
    });
    return;
  }

  const env = opts.env ?? process.env;
  const auth = authorizeCronRequest(req, env);
  if (auth === 'unauthorized') {
    res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' },
    });
    return;
  }
  if (auth === 'missing_config') {
    res.status(503).json({
      ok: false,
      error: {
        code: 'MISSING_CONFIG',
        message: 'Matcher is temporarily unavailable.',
      },
    });
    return;
  }

  let storage: MatcherStorage;
  try {
    if (opts.storage) {
      storage = opts.storage;
    } else {
      const supabase = SupabaseAlertStorage.fromEnv(env);
      if (!supabase) throw new StorageConfigError();
      storage = supabase;
    }
  } catch {
    res.status(503).json({
      ok: false,
      error: {
        code: 'MISSING_CONFIG',
        message: 'Matcher is temporarily unavailable.',
      },
    });
    return;
  }

  const dryRun = isDryRunRequest(req);
  const loaded = opts.snapshot
    ? { ok: true as const, snapshot: opts.snapshot, source: 'injected' }
    : await loadSpreadSnapshot({ env });

  if (!loaded.ok) {
    const reason = loaded.reason === 'malformed' ? 'invalid_snapshot' : 'snapshot_unavailable';
    res.status(200).json({
      ok: true,
      dry_run: dryRun,
      skip_reason: reason,
      alerts_checked: 0,
      opportunities_checked: 0,
      matches: 0,
      emails_sent: 0,
      emails_failed: 0,
      duplicates_skipped: 0,
      cooldown_skipped: 0,
      stale_data_skips: 0,
      missing_trade_amount: 0,
      duration_ms: 0,
    });
    return;
  }

  const email = opts.email ?? getEmailAdapter(env);
  const summary = await runAlertMatcher({
    storage,
    email,
    snapshot: loaded.snapshot,
    siteOrigin: env.ALERTS_SITE_ORIGIN || 'https://coinnavigator.net',
    dryRun,
    ...(opts.now ? { now: opts.now } : {}),
    ...(opts.log ? { log: opts.log } : {}),
  });

  res.status(200).json(summary);
}
