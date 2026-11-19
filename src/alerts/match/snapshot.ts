import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  parseSpreadSnapshot,
  snapshotAgeMs,
  type SpreadSnapshot,
} from './opportunities.js';
import { MATCHER_STALE_MS } from './policies.js';

export type SnapshotLoadResult =
  | { ok: true; snapshot: SpreadSnapshot; source: string }
  | { ok: false; reason: 'malformed' | 'unavailable' };

export type LocalSnapshotReader = (rel: string) => Promise<unknown | null>;

async function readLocalJson(rel: string): Promise<unknown | null> {
  try {
    const text = await readFile(resolve(process.cwd(), rel), 'utf8');
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
): Promise<unknown | null> {
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/** Accept committed JSON or the live gateway envelope `{ ok, data }`. */
export function parseMaybeWrappedSnapshot(raw: unknown): SpreadSnapshot | null {
  const direct = parseSpreadSnapshot(raw);
  if (direct) return direct;
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (body.data && typeof body.data === 'object') {
    return parseSpreadSnapshot(body.data);
  }
  return null;
}

function pickBestSnapshot(
  candidates: Array<{ snapshot: SpreadSnapshot; source: string }>,
  now: number,
): { snapshot: SpreadSnapshot; source: string } | null {
  if (!candidates.length) return null;
  const fresh = candidates.filter((c) => snapshotAgeMs(c.snapshot, now) <= MATCHER_STALE_MS);
  const pool = fresh.length ? fresh : candidates;
  pool.sort((a, b) => Date.parse(b.snapshot.timestamp) - Date.parse(a.snapshot.timestamp));
  return pool[0] ?? null;
}

/**
 * Shared opportunity snapshot. Never per-alert exchange calls.
 * Prefer the live market-data gateway (same source as the homepage).
 * Fall back to committed JSON / the public site copy if the gateway is down.
 */
export async function loadSpreadSnapshot(opts: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  injected?: unknown;
  now?: number;
  readLocal?: LocalSnapshotReader;
}): Promise<SnapshotLoadResult> {
  if (opts.injected !== undefined) {
    const parsed = parseMaybeWrappedSnapshot(opts.injected);
    return parsed
      ? { ok: true, snapshot: parsed, source: 'injected' }
      : { ok: false, reason: 'malformed' };
  }

  const env = opts.env ?? process.env;
  const now = opts.now ?? Date.now();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const readLocal = opts.readLocal ?? readLocalJson;
  const origin = (env.ALERTS_SITE_ORIGIN || 'https://www.coinnavigator.net').replace(/\/$/, '');
  const candidates: Array<{ snapshot: SpreadSnapshot; source: string }> = [];

  const liveRaw = await fetchJson(
    `${origin}/api/market-data?operation=spread_snapshot`,
    fetchImpl,
  );
  const liveParsed = parseMaybeWrappedSnapshot(liveRaw);
  if (liveParsed) candidates.push({ snapshot: liveParsed, source: 'live_gateway' });

  for (const rel of ['data/spread_data.json', 'spread_data.json']) {
    const raw = await readLocal(rel);
    if (raw == null) continue;
    const parsed = parseMaybeWrappedSnapshot(raw);
    if (parsed) candidates.push({ snapshot: parsed, source: rel });
  }

  if (!candidates.some((c) => c.source === 'live_gateway')) {
    for (const path of ['/data/spread_data.json', '/spread_data.json']) {
      const raw = await fetchJson(`${origin}${path}`, fetchImpl);
      if (raw == null) continue;
      const parsed = parseMaybeWrappedSnapshot(raw);
      if (parsed) candidates.push({ snapshot: parsed, source: `http:${path}` });
    }
  }

  const best = pickBestSnapshot(candidates, now);
  if (!best) return { ok: false, reason: 'unavailable' };
  return { ok: true, snapshot: best.snapshot, source: best.source };
}
