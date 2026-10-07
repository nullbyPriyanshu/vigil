import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PASSWORD_RESET_TTL_MS } from 'src/auth/auth.constants';
import {
  type Email,
  forgotPasswordEmail,
  incidentEmail,
  invitationEmail,
  passwordChangedEmail,
  passwordResetEmail,
} from './templates';

function formatNow(timeZone: string) {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format();
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      ...options,
      timeZone: 'UTC',
    }).format();
  }
}

@Injectable()
export class MailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );

    this.from = this.configService.getOrThrow<string>('MAIL_FROM');

    this.frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    if (!this.frontendUrl) {
      throw new Error('FRONTEND_URL must be set (e.g. http://localhost:3000)');
    }
  }

  sendForgotPasswordEmail(email: string, name: string, resetToken: string) {
    return this.send(
      email,
      forgotPasswordEmail({
        name,
        resetUrl: `${this.frontendUrl}/reset-password?token=${resetToken}`,
        expiresInMinutes: PASSWORD_RESET_TTL_MS / 60_000,
      }),
    );
  }

  sendPasswordResetSuccessEmail(email: string, name: string) {
    return this.send(
      email,
      passwordResetEmail({ name, forgotUrl: this.forgotUrl() }),
    );
  }

  sendPasswordChangedEmail(email: string, name: string, timezone: string) {
    return this.send(
      email,
      passwordChangedEmail({
        name,
        changedAt: formatNow(timezone),
        forgotUrl: this.forgotUrl(),
      }),
    );
  }

  sendInvitationEmail(
    email: string,
    opts: {
      inviterName: string;
      organizationName: string;
      roleLabel: string;
      token: string;
      expiresInDays: number;
    },
  ) {
    return this.send(
      email,
      invitationEmail({
        inviterName: opts.inviterName,
        organizationName: opts.organizationName,
        roleLabel: opts.roleLabel,
        acceptUrl: `${this.frontendUrl}/invite/${opts.token}`,
        expiresInDays: opts.expiresInDays,
      }),
    );
  }

  sendIncidentEmail(
    email: string,
    opts: {
      name: string;
      incidentNumber: number;
      title: string;
      severity: string;
      serviceName: string;
      acknowledgeToken: string;
      resolveToken: string;
    },
  ) {
    return this.send(
      email,
      incidentEmail({
        name: opts.name,
        incidentNumber: opts.incidentNumber,
        title: opts.title,
        severity: opts.severity,
        serviceName: opts.serviceName,
        acknowledgeUrl: `${this.frontendUrl}/a/${opts.acknowledgeToken}`,
        resolveUrl: `${this.frontendUrl}/a/${opts.resolveToken}`,
        incidentUrl: `${this.frontendUrl}/incidents/${opts.incidentNumber}`,
      }),
    );
  }

  verifyWebhook(
    payload: string,
    headers: { id: string; timestamp: string; signature: string },
  ) {
    const webhookSecret = this.configService.get<string>(
      'RESEND_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('RESEND_WEBHOOK_SECRET is missing from .env');
    }

    return this.resend.webhooks.verify({ payload, headers, webhookSecret });
  }

  private forgotUrl() {
    return `${this.frontendUrl}/forgot-password`;
  }

  private async send(to: string, email: Email) {
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to send "${email.subject}" email: ${error.message}`,
      );
    }

    return data;
  }
}
