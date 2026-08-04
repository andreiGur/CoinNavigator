import type { AlertStorage } from './storage.js';
import { StorageConfigError, StorageFailureError } from './storage.js';
import { createId, createUnsubscribeToken } from './tokens.js';
import { validateCreateAlertInput, validateUnsubscribeToken } from './validate.js';
import type { ApiResponse } from './types.js';
import type { EmailAdapter } from './email.js';
import { NoopEmailAdapter } from './email.js';

export interface CreateAlertDeps {
  storage: AlertStorage;
  email?: EmailAdapter;
  siteOrigin?: string;
  now?: () => string;
}

export interface CreateAlertResult {
  response: ApiResponse;
  httpStatus: number;
  /** Never include email in analytics — use these flags only */
  analytics: {
    outcome: 'created' | 'already_exists' | 'failed';
    failure_category?: string;
    asset?: string;
    alert_scope?: string;
  };
}

function genericValidation(): ApiResponse {
  return {
    ok: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Please check the submitted details.',
    },
  };
}

export async function createAlertSubscription(
  rawBody: unknown,
  deps: CreateAlertDeps,
): Promise<CreateAlertResult> {
  const validated = validateCreateAlertInput(rawBody);
  if (!validated.ok) {
    const category =
      validated.reason === 'honeypot'
        ? 'honeypot'
        : validated.reason === 'missing_consent'
          ? 'missing_consent'
          : validated.reason === 'unsupported_asset'
            ? 'unsupported_asset'
            : validated.reason === 'unsupported_exchange' ||
                validated.reason === 'invalid_exchange_pair'
              ? 'unsupported_exchange'
              : validated.reason === 'invalid_email'
                ? 'invalid_email'
                : 'validation';
    return {
      response: genericValidation(),
      httpStatus: 400,
      analytics: { outcome: 'failed', failure_category: category },
    };
  }

  const input = validated.value;
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const email = deps.email ?? new NoopEmailAdapter();

  try {
    const active = await deps.storage.findActiveDuplicate(input);
    if (active) {
      return {
        response: {
          ok: true,
          status: 'already_exists',
          email_delivery: email.isEnabled() ? 'skipped' : 'disabled',
        },
        httpStatus: 200,
        analytics: {
          outcome: 'already_exists',
          asset: input.asset,
          alert_scope: input.alert_scope,
        },
      };
    }

    const unsubscribed = await deps.storage.findUnsubscribedDuplicate(input);
    let created;
    if (unsubscribed) {
      created = await deps.storage.reactivate(unsubscribed, input, {
        unsubscribe_token: createUnsubscribeToken(),
        now,
      });
    } else {
      created = await deps.storage.create(input, {
        id: createId(),
        unsubscribe_token: createUnsubscribeToken(),
        now,
      });
    }

    let delivery: 'disabled' | 'queued' | 'skipped' = email.isEnabled() ? 'skipped' : 'disabled';
    if (email.isEnabled()) {
      const origin = (deps.siteOrigin || 'https://coinnavigator.net').replace(/\/$/, '');
      const status = await email.sendAlertConfirmation({
        to: created.email,
        asset: created.asset,
        alertScope: created.alert_scope,
        unsubscribeUrl: `${origin}/api/alerts/unsubscribe?token=${created.unsubscribe_token}`,
      });
      delivery = status === 'queued' ? 'queued' : status === 'disabled' ? 'disabled' : 'skipped';
    }

    return {
      response: {
        ok: true,
        status: 'created',
        email_delivery: delivery,
      },
      httpStatus: 201,
      analytics: {
        outcome: 'created',
        asset: input.asset,
        alert_scope: input.alert_scope,
      },
    };
  } catch (err) {
    if (err instanceof StorageConfigError) {
      return {
        response: {
          ok: false,
          error: {
            code: 'MISSING_CONFIG',
            message: 'Alert storage is temporarily unavailable.',
          },
        },
        httpStatus: 503,
        analytics: {
          outcome: 'failed',
          failure_category: 'missing_config',
          asset: input.asset,
          alert_scope: input.alert_scope,
        },
      };
    }
    if (err instanceof StorageFailureError) {
      return {
        response: {
          ok: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'Unable to save your alert right now. Please try again later.',
          },
        },
        httpStatus: 503,
        analytics: {
          outcome: 'failed',
          failure_category: 'storage_failure',
          asset: input.asset,
          alert_scope: input.alert_scope,
        },
      };
    }
    return {
      response: {
        ok: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Unable to save your alert right now. Please try again later.',
        },
      },
      httpStatus: 500,
      analytics: {
        outcome: 'failed',
        failure_category: 'server_error',
        asset: input.asset,
        alert_scope: input.alert_scope,
      },
    };
  }
}

export async function unsubscribeAlert(
  tokenRaw: unknown,
  storage: AlertStorage,
  now = () => new Date().toISOString(),
): Promise<{ response: ApiResponse; httpStatus: number }> {
  const token = validateUnsubscribeToken(tokenRaw);
  if (!token) {
    return {
      response: {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check the submitted details.',
        },
      },
      httpStatus: 400,
    };
  }

  try {
    const result = await storage.markUnsubscribed(token, now());
    if (result === 'not_found') {
      return {
        response: {
          ok: false,
          error: { code: 'NOT_FOUND', message: 'This unsubscribe link is not valid.' },
        },
        httpStatus: 404,
      };
    }
    return {
      response: {
        ok: true,
        status: result === 'already_unsubscribed' ? 'already_unsubscribed' : 'unsubscribed',
      },
      httpStatus: 200,
    };
  } catch (err) {
    if (err instanceof StorageConfigError) {
      return {
        response: {
          ok: false,
          error: {
            code: 'MISSING_CONFIG',
            message: 'Alert storage is temporarily unavailable.',
          },
        },
        httpStatus: 503,
      };
    }
    return {
      response: {
        ok: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Unable to process unsubscribe right now.',
        },
      },
      httpStatus: 503,
    };
  }
}
