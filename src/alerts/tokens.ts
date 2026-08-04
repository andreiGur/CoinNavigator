import { createHash, randomBytes } from 'node:crypto';

export function createUnsubscribeToken(): string {
  return randomBytes(32).toString('hex');
}

export function createId(): string {
  return randomBytes(16).toString('hex');
}

/** Privacy-safe abuse signal — never store raw UA. */
export function hashUserAgent(userAgent: string | undefined | null): string | null {
  if (!userAgent || typeof userAgent !== 'string') return null;
  const trimmed = userAgent.trim().slice(0, 512);
  if (!trimmed) return null;
  return createHash('sha256').update(trimmed).digest('hex').slice(0, 32);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
