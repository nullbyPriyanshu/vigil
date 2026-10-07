import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma.service';
import { WebhooksService } from './webhooks.service';

jest.mock('../mail/mail.service', () => ({ MailService: class {} }));

const HEADERS = { id: 'msg_1', timestamp: '1', signature: 'v1,abc' };

describe('WebhooksService', () => {
  let service: WebhooksService;
  let mail: { verifyWebhook: jest.Mock };
  let prisma: {
    notification: { findUnique: jest.Mock; update: jest.Mock };
    incidentEvent: { create: jest.Mock };
  };

  const event = (type: string) =>
    mail.verifyWebhook.mockReturnValue({ type, data: { email_id: 're_123' } });

  beforeEach(async () => {
    mail = { verifyWebhook: jest.fn() };
    prisma = {
      notification: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'n1',
          status: 'SENT',
          incidentId: 'i1',
          user: { name: 'Priyanshu Maurya' },
        }),
        update: jest.fn(),
      },
      incidentEvent: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = moduleRef.get(WebhooksService);
  });

  it('gives 401 when the signature does not check out', async () => {
    mail.verifyWebhook.mockImplementation(() => {
      throw new Error('bad signature');
    });

    await expect(
      service.handleResendEvent('{}', HEADERS),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.notification.findUnique).not.toHaveBeenCalled();
  });

  it('marks the notification delivered and adds a timeline event', async () => {
    event('email.delivered');

    await expect(service.handleResendEvent('{}', HEADERS)).resolves.toEqual({
      received: true,
    });

    expect(prisma.notification.findUnique).toHaveBeenCalledWith({
      where: { providerMessageId: 're_123' },
      include: { user: true },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'DELIVERED' },
    });
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
      data: {
        incidentId: 'i1',
        type: 'NOTIFICATION_DELIVERED',
        actorType: 'SYSTEM',
        message: 'Email delivered to Priyanshu Maurya',
        metadata: { notificationId: 'n1', status: 'DELIVERED' },
      },
    });
  });

  it.each(['email.bounced', 'email.complained', 'email.failed'])(
    'marks %s as failed',
    async (type) => {
      event(type);

      await service.handleResendEvent('{}', HEADERS);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { status: 'FAILED' },
      });
    },
  );

  it('answers 200 and changes nothing for other events, unknown emails and repeats', async () => {
    event('email.opened');
    await expect(service.handleResendEvent('{}', HEADERS)).resolves.toEqual({
      received: true,
    });

    event('email.delivered');
    prisma.notification.findUnique.mockResolvedValue(null);
    await expect(service.handleResendEvent('{}', HEADERS)).resolves.toEqual({
      received: true,
    });

    prisma.notification.findUnique.mockResolvedValue({
      id: 'n1',
      status: 'DELIVERED',
      incidentId: 'i1',
      user: { name: 'P' },
    });
    await expect(service.handleResendEvent('{}', HEADERS)).resolves.toEqual({
      received: true,
    });

    expect(prisma.notification.update).not.toHaveBeenCalled();
    expect(prisma.incidentEvent.create).not.toHaveBeenCalled();
  });
});
