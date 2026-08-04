/**
 * Optional confirmation-email adapter.
 * Delivery stays disabled unless RESEND_API_KEY is set.
 */

export type EmailDeliveryStatus = 'disabled' | 'queued' | 'skipped' | 'failed';

export interface ConfirmationEmailPayload {
  to: string;
  asset: string;
  alertScope: string;
  unsubscribeUrl: string;
}

export interface EmailAdapter {
  isEnabled(): boolean;
  sendAlertConfirmation(payload: ConfirmationEmailPayload): Promise<EmailDeliveryStatus>;
}

export class ResendEmailAdapter implements EmailAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): ResendEmailAdapter | null {
    const apiKey = (env.RESEND_API_KEY || '').trim();
    if (!apiKey) return null;
    const fromAddress = (env.ALERTS_FROM_EMAIL || 'CoinNavigator <alerts@coinnavigator.net>').trim();
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
}

export class NoopEmailAdapter implements EmailAdapter {
  isEnabled(): boolean {
    return false;
  }

  async sendAlertConfirmation(): Promise<EmailDeliveryStatus> {
    return 'disabled';
  }
}

export function getEmailAdapter(env: NodeJS.ProcessEnv = process.env): EmailAdapter {
  return ResendEmailAdapter.fromEnv(env) ?? new NoopEmailAdapter();
}
