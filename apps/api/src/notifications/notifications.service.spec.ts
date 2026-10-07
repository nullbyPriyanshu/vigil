import { createHash } from 'crypto';
import { Test } from '@nestjs/testing';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma.service';
import { SchedulesService } from '../schedules/schedules.service';
import { NotificationsService } from './notifications.service';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

jest.mock('../mail/mail.service', () => ({ MailService: class {} }));

const RAHUL = { id: 'u2', name: 'Rahul Verma', email: 'rahul@acme.com' };
const SNEHA = { id: 'u3', name: 'Sneha Kapoor', email: 'sneha@acme.com' };

const incident = (step: Record<string, unknown>) => ({
  id: 'i1',
  number: 142,
  title: 'Pool exhausted',
  severity: 'CRITICAL',
  organizationId: 'o1',
  currentStepPosition: 1,
  service: {
    name: 'Checkout API',
    escalationPolicy: {
      steps: [
        {
          position: 1,
          delayMinutes: 5,
          userId: null,
          teamId: null,
          scheduleId: null,
          ...step,
        },
      ],
    },
  },
});

function createPrismaMock() {
  return {
    incident: { findUnique: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue(RAHUL) },
    membership: {
      findMany: jest.fn().mockResolvedValue([{ user: RAHUL }, { user: SNEHA }]),
    },
    actionToken: { createMany: jest.fn() },
    notification: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        id: 'n1',
        ...data,
      })),
    },
    incidentEvent: { create: jest.fn() },
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let mail: { sendIncidentEmail: jest.Mock };
  let schedules: { findOnCallUser: jest.Mock };

  const emailedTo = () =>
    (mail.sendIncidentEmail.mock.calls as [string][]).map((call) => call[0]);

  beforeEach(async () => {
    prisma = createPrismaMock();
    mail = { sendIncidentEmail: jest.fn().mockResolvedValue({ id: 're_123' }) };
    schedules = { findOnCallUser: jest.fn().mockResolvedValue(SNEHA) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: SchedulesService, useValue: schedules },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('emails the person on a USER step, with links whose hashes are stored', async () => {
    prisma.incident.findUnique.mockResolvedValue(incident({ userId: 'u2' }));

    await service.notifyStep('i1', 1);

    const sent = mail.sendIncidentEmail.mock.calls[0] as [
      string,
      { acknowledgeToken: string; resolveToken: string },
    ];
    const tokens = (
      prisma.actionToken.createMany.mock.calls[0] as [
        { data: { tokenHash: string; action: string; userId: string }[] },
      ]
    )[0].data;
    expect(sent[0]).toBe('rahul@acme.com');
    expect(tokens.map((t) => [t.action, t.userId, t.tokenHash])).toEqual([
      ['ACKNOWLEDGE', 'u2', hashToken(sent[1].acknowledgeToken)],
      ['RESOLVE', 'u2', hashToken(sent[1].resolveToken)],
    ]);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        incidentId: 'i1',
        userId: 'u2',
        stepPosition: 1,
        status: 'SENT',
        providerMessageId: 're_123',
      },
    });
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'NOTIFICATION_SENT',
        message: 'Email sent to Rahul Verma',
      }) as unknown,
    });
  });

  it('emails everyone on a TEAM step except viewers', async () => {
    prisma.incident.findUnique.mockResolvedValue(incident({ teamId: 't1' }));

    await service.notifyStep('i1', 1);

    expect(emailedTo()).toEqual(['rahul@acme.com', 'sneha@acme.com']);
    const query = (
      prisma.membership.findMany.mock.calls[0] as [{ where: { role: unknown } }]
    )[0];
    expect(query.where.role).toEqual({ not: 'VIEWER' });
  });

  it('emails whoever is on call for a SCHEDULE step', async () => {
    prisma.incident.findUnique.mockResolvedValue(
      incident({ scheduleId: 'sc1' }),
    );

    await service.notifyStep('i1', 1);

    expect(emailedTo()).toEqual(['sneha@acme.com']);
  });

  it('emails the owners and admins when nobody is on call, and says so', async () => {
    prisma.incident.findUnique.mockResolvedValue(
      incident({ scheduleId: 'sc1' }),
    );
    schedules.findOnCallUser.mockResolvedValue(null);

    await service.notifyStep('i1', 1);

    const query = (
      prisma.membership.findMany.mock.calls[0] as [{ where: unknown }]
    )[0];
    expect(query.where).toEqual({
      organizationId: 'o1',
      role: { in: ['OWNER', 'ADMIN'] },
    });
    expect(emailedTo()).toEqual(['rahul@acme.com', 'sneha@acme.com']);
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        message:
          'Nobody is on call for this schedule. Notifying the admins instead',
      }) as unknown,
    });
  });

  it('skips someone who turned incident emails off, and says so', async () => {
    prisma.incident.findUnique.mockResolvedValue(incident({ userId: 'u2' }));
    prisma.user.findUnique.mockResolvedValue({
      ...RAHUL,
      emailNotifications: false,
    });

    await service.notifyStep('i1', 1);

    expect(mail.sendIncidentEmail).not.toHaveBeenCalled();
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'NOTIFICATION_FAILED',
        message: 'Rahul Verma has incident emails turned off',
      }) as unknown,
    });
  });

  it('does nothing for a step the policy does not have', async () => {
    prisma.incident.findUnique.mockResolvedValue(incident({ userId: 'u2' }));

    await service.notifyStep('i1', 5);

    expect(mail.sendIncidentEmail).not.toHaveBeenCalled();
  });

  it('records a failed notification when the email cannot be sent', async () => {
    prisma.incident.findUnique.mockResolvedValue(incident({ userId: 'u2' }));
    mail.sendIncidentEmail.mockRejectedValue(new Error('down'));

    await service.notifyStep('i1', 1);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'FAILED',
        providerMessageId: null,
      }) as unknown,
    });
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'NOTIFICATION_FAILED' }) as unknown,
    });
  });
});
