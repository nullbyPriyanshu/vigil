import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async handleResendEvent(
    payload: string,
    headers: { id: string; timestamp: string; signature: string },
  ) {
    let event: { type: string; data: { email_id?: string } };
    try {
      event = this.mailService.verifyWebhook(payload, headers) as typeof event;
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let status: 'DELIVERED' | 'FAILED' | null = null;
    if (event.type === 'email.delivered') {
      status = 'DELIVERED';
    }
    if (
      event.type === 'email.bounced' ||
      event.type === 'email.complained' ||
      event.type === 'email.failed'
    ) {
      status = 'FAILED';
    }

    if (!status || !event.data.email_id) {
      return { received: true };
    }

    const notification = await this.prisma.notification.findUnique({
      where: { providerMessageId: event.data.email_id },
      include: { user: true },
    });
    if (!notification || notification.status === status) {
      return { received: true };
    }

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { status },
    });

    await this.prisma.incidentEvent.create({
      data: {
        incidentId: notification.incidentId,
        type:
          status === 'DELIVERED'
            ? 'NOTIFICATION_DELIVERED'
            : 'NOTIFICATION_FAILED',
        actorType: 'SYSTEM',
        message:
          status === 'DELIVERED'
            ? `Email delivered to ${notification.user.name}`
            : `Email to ${notification.user.name} could not be delivered`,
        metadata: { notificationId: notification.id, status },
      },
    });

    return { received: true };
  }
}
