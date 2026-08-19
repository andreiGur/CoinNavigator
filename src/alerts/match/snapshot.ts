import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseSpreadSnapshot, type SpreadSnapshot } from './opportunities.js';

export type SnapshotLoadResult =
  | { ok: true; snapshot: SpreadSnapshot; source: string }
  | { ok: false; reason: 'malformed' | 'unavailable' };

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
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Shared opportunity snapshot. Never per-alert exchange calls.
 * Local deployment files first, then the public site copy.
 */
export async function loadSpreadSnapshot(opts: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  injected?: unknown;
}): Promise<SnapshotLoadResult> {
  if (opts.injected !== undefined) {
    const parsed = parseSpreadSnapshot(opts.injected);
    return parsed
      ? { ok: true, snapshot: parsed, source: 'injected' }
      : { ok: false, reason: 'malformed' };
  }

  const env = opts.env ?? process.env;
  const localCandidates = ['data/spread_data.json', 'spread_data.json'];
  for (const rel of localCandidates) {
    const raw = await readLocalJson(rel);
    if (raw == null) continue;
    const parsed = parseSpreadSnapshot(raw);
    if (parsed) return { ok: true, snapshot: parsed, source: rel };
    return { ok: false, reason: 'malformed' };
  }

  const origin = (env.ALERTS_SITE_ORIGIN || 'https://coinnavigator.net').replace(/\/$/, '');
  const fetchImpl = opts.fetchImpl ?? fetch;
  for (const path of ['/data/spread_data.json', '/spread_data.json']) {
    const raw = await fetchJson(`${origin}${path}`, fetchImpl);
    if (raw == null) continue;
    const parsed = parseSpreadSnapshot(raw);
    if (parsed) return { ok: true, snapshot: parsed, source: `http:${path}` };
    return { ok: false, reason: 'malformed' };
  }

  return { ok: false, reason: 'unavailable' };
}
