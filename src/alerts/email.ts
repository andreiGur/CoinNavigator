/**
 * Optional email adapter.
 * Confirmation and opportunity delivery stay disabled unless RESEND_API_KEY is set.
 */

export type EmailDeliveryStatus = 'disabled' | 'queued' | 'skipped' | 'failed';

export interface ConfirmationEmailPayload {
  to: string;
  asset: string;
  alertScope: string;
  unsubscribeUrl: string;
}

export interface OpportunitySendPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface OpportunitySendResult {
  status: 'queued' | 'failed' | 'disabled';
  provider: 'resend' | null;
  messageId: string | null;
  failureCategory: 'provider_unavailable' | 'provider_rejected' | 'missing_config' | null;
}

export interface EmailAdapter {
  isEnabled(): boolean;
  sendAlertConfirmation(payload: ConfirmationEmailPayload): Promise<EmailDeliveryStatus>;
  sendOpportunityEmail(payload: OpportunitySendPayload): Promise<OpportunitySendResult>;
}

function parseResendId(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const id = (json as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id.trim().slice(0, 128) : null;
}

export class ResendEmailAdapter implements EmailAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): ResendEmailAdapter | null {
    const apiKey = (env.RESEND_API_KEY || '').trim();
    if (!apiKey) return null;
    const fromAddress = (env.ALERTS_FROM_EMAIL || 'CoinNavigator Alerts <alerts@coinnavigator.net>').trim();
    return new ResendEmailAdapter(apiKey, fromAddress);
  }

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  async sendAlertConfirmation(payload: ConfirmationEmailPayload): Promise<EmailDeliveryStatus> {
    if (!this.isEnabled()) return 'disabled';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [payload.to],
          subject: 'CoinNavigator alert subscription confirmed',
          text: [
            `Your CoinNavigator opportunity alert for ${payload.asset} (${payload.alertScope}) is active.`,
            '',
            'Alerts are estimates, not financial advice. Market conditions may change before execution.',
            '',
            `Unsubscribe: ${payload.unsubscribeUrl}`,
          ].join('\n'),
        }),
      });
      if (!res.ok) return 'failed';
      return 'queued';
    } catch {
      return 'failed';
    }
  }

  async sendOpportunityEmail(payload: OpportunitySendPayload): Promise<OpportunitySendResult> {
    if (!this.isEnabled()) {
      return {
        status: 'disabled',
        provider: null,
        messageId: null,
        failureCategory: 'missing_config',
      };
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [payload.to],
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
        }),
      });
      if (!res.ok) {
        return {
          status: 'failed',
          provider: 'resend',
          messageId: null,
          failureCategory: res.status >= 500 ? 'provider_unavailable' : 'provider_rejected',
        };
      }
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      return {
        status: 'queued',
        provider: 'resend',
        messageId: parseResendId(json),
        failureCategory: null,
      };
    } catch {
      return {
        status: 'failed',
        provider: 'resend',
        messageId: null,
        failureCategory: 'provider_unavailable',
      };
    }
  }
}

export class NoopEmailAdapter implements EmailAdapter {
  isEnabled(): boolean {
    return false;
  }

  async sendAlertConfirmation(): Promise<EmailDeliveryStatus> {
    return 'disabled';
  }

  async sendOpportunityEmail(): Promise<OpportunitySendResult> {
    return {
      status: 'disabled',
      provider: null,
      messageId: null,
      failureCategory: 'missing_config',
    };
  }
}

export function getEmailAdapter(env: NodeJS.ProcessEnv = process.env): EmailAdapter {
  return ResendEmailAdapter.fromEnv(env) ?? new NoopEmailAdapter();
}
