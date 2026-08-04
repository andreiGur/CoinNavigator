import { normalizeAsset, normalizeExchange } from './allowlist.js';
import { hashUserAgent, normalizeEmail } from './tokens.js';
import {
  CONSENT_VERSION,
  type AlertScope,
  type CreateAlertInput,
  type ValidatedCreateAlert,
} from './types.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SOURCE_LEN = 120;
const MAX_PCT = 100;
const MAX_USD = 1_000_000;

export type ValidationFailure = { ok: false; reason: string };
export type ValidationSuccess = { ok: true; value: ValidatedCreateAlert };
export type ValidationResult = ValidationFailure | ValidationSuccess;

function asFiniteNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clipSource(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  return raw.trim().slice(0, MAX_SOURCE_LEN);
}

export function validateCreateAlertInput(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'invalid_payload' };
  }
  const body = raw as Partial<CreateAlertInput> & Record<string, unknown>;

  // Honeypot
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return { ok: false, reason: 'honeypot' };
  }

  if (body.consent !== true) {
    return { ok: false, reason: 'missing_consent' };
  }

  if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email.trim())) {
    return { ok: false, reason: 'invalid_email' };
  }
  const email = normalizeEmail(body.email);
  if (email.length > 254) {
    return { ok: false, reason: 'invalid_email' };
  }

  const asset = normalizeAsset(body.asset);
  if (!asset) {
    return { ok: false, reason: 'unsupported_asset' };
  }

  const scopeRaw = body.alert_scope;
  if (scopeRaw !== 'exact_pair' && scopeRaw !== 'any_pair') {
    return { ok: false, reason: 'invalid_scope' };
  }
  const alert_scope: AlertScope = scopeRaw;

  let buy_exchange = normalizeExchange(body.buy_exchange);
  let sell_exchange = normalizeExchange(body.sell_exchange);

  if (alert_scope === 'exact_pair') {
    if (!buy_exchange || !sell_exchange) {
      return { ok: false, reason: 'unsupported_exchange' };
    }
    if (buy_exchange === sell_exchange) {
      return { ok: false, reason: 'invalid_exchange_pair' };
    }
  } else {
    // any_pair: exchanges optional; ignore client values for matching
    buy_exchange = null;
    sell_exchange = null;
  }

  const minPct = asFiniteNumber(body.minimum_net_profit_pct);
  if (minPct !== null && (minPct < 0 || minPct > MAX_PCT)) {
    return { ok: false, reason: 'invalid_threshold' };
  }

  const minUsd = asFiniteNumber(body.minimum_net_profit_usd);
  if (minUsd !== null && (minUsd < 0 || minUsd > MAX_USD)) {
    return { ok: false, reason: 'invalid_threshold' };
  }

  const consent_version =
    typeof body.consent_version === 'string' && body.consent_version.trim()
      ? body.consent_version.trim().slice(0, 64)
      : CONSENT_VERSION;

  return {
    ok: true,
    value: {
      email,
      asset,
      buy_exchange,
      sell_exchange,
      alert_scope,
      minimum_net_profit_pct: minPct,
      minimum_net_profit_usd: minUsd,
      source_page: clipSource(body.source_page, 'home'),
      source_context: clipSource(body.source_context, 'check_real_profit'),
      consent_version,
      user_agent_hash: hashUserAgent(
        typeof body.user_agent === 'string' ? body.user_agent : null,
      ),
    },
  };
}

export function validateUnsubscribeToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const token = raw.trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  return token.toLowerCase();
}
