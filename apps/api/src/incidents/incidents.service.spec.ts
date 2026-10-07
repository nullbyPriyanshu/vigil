import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { EscalationService } from '../escalation/escalation.service';
import { RealtimeService } from '../realtime/realtime.service';
import { IncidentsService } from './incidents.service';

jest.mock('../escalation/escalation.service', () => ({
  EscalationService: class {},
}));
jest.mock('../realtime/realtime.service', () => ({
  RealtimeService: class {},
}));

const NOW = new Date('2026-01-12T21:44:00.000Z');
const RAHUL = { id: 'u2', name: 'Rahul Verma', email: 'rahul@acme.com' };

const STORED = {
  id: 'i1',
  number: 142,
  title: 'Pool exhausted',
  description: '45 of 45 in use',
  severity: 'CRITICAL',
  status: 'TRIGGERED',
  dedupKey: 'db-pool',
  createdAt: NOW,
  lastAlertAt: NOW,
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolvedBy: null,
  currentStepPosition: 1,
  escalationRound: 0,
  nextEscalationAt: null,
  organizationId: 'o1',
  alerts: [{ id: 'a1' }, { id: 'a2' }],
  notifications: [
    { stepPosition: 1, status: 'DELIVERED', createdAt: NOW, user: RAHUL },
  ],
  service: {
    id: 's1',
    name: 'Checkout API',
    team: { id: 't1', name: 'Platform Team' },
    escalationPolicy: {
      id: 'p1',
      name: 'Platform Critical',
      repeatCount: 1,
      steps: [
        {
          position: 1,
          delayMinutes: 5,
          targetType: 'USER',
          user: RAHUL,
          team: null,
          schedule: null,
        },
        {
          position: 2,
          delayMinutes: 10,
          targetType: 'SCHEDULE',
          user: null,
          team: null,
          schedule: { id: 'sc1', name: 'Platform Weekly' },
        },
      ],
    },
  },
};

function createPrismaMock() {
  return {
    incident: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([STORED]),
      findUnique: jest.fn().mockResolvedValue(STORED),
      findUniqueOrThrow: jest.fn().mockResolvedValue(STORED),
      findFirst: jest.fn().mockResolvedValue(STORED),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    incidentEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        id: 'e1',
        createdAt: NOW,
        metadata: null,
        ...data,
      })),
    },
    alert: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    membership: {
      findUnique: jest.fn().mockResolvedValue({
        role: 'RESPONDER',
        user: { id: 'u1', name: 'Priyanshu Maurya' },
      }),
    },
  };
}

describe('IncidentsService', () => {
  let service: IncidentsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let realtime: { emitIncident: jest.Mock };
  let escalation: { cancel: jest.Mock };

  const eventTypes = () =>
    (
      prisma.incidentEvent.create.mock.calls as [{ data: { type: string } }][]
    ).map((call) => call[0].data.type);

  beforeEach(async () => {
    prisma = createPrismaMock();
    realtime = { emitIncident: jest.fn() };
    escalation = { cancel: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeService, useValue: realtime },
        { provide: EscalationService, useValue: escalation },
      ],
    }).compile();
    service = moduleRef.get(IncidentsService);
  });

  it('lists incidents with counts and page info', async () => {
    prisma.incident.count.mockResolvedValue(142);

    const result = await service.listIncidents('o1', { page: 1, pageSize: 25 });

    expect(result.data[0]).toMatchObject({
      number: 142,
      service: { id: 's1', name: 'Checkout API' },
      alertCount: 2,
      currentStepPosition: 1,
      totalSteps: 2,
      acknowledgedBy: null,
    });
    expect(result.meta).toEqual({
      page: 1,
      pageSize: 25,
      total: 142,
      totalPages: 6,
    });
  });

  it('applies filters and paging inside this organization, newest first', async () => {
    await service.listIncidents('o1', {
      page: 3,
      pageSize: 10,
      status: 'TRIGGERED',
      severity: 'CRITICAL',
      service: 's1',
    });

    const query = (
      prisma.incident.findMany.mock.calls[0] as [Record<string, unknown>]
    )[0];
    expect(query.where).toEqual({
      organizationId: 'o1',
      status: 'TRIGGERED',
      severity: 'CRITICAL',
      serviceId: 's1',
    });
    expect(query.orderBy).toEqual({ createdAt: 'desc' });
    expect(query.skip).toBe(20);
    expect(query.take).toBe(10);
  });

  it('gives 404 for an unknown incident number in this organization', async () => {
    prisma.incident.findUnique.mockResolvedValue(null);

    await expect(service.getIncidentByNumber('o1', 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.incident.findUnique).toHaveBeenCalledWith({
      where: { organizationId_number: { organizationId: 'o1', number: 999 } },
    });
  });

  it('shows escalation steps by name, with who was notified', async () => {
    const incident = await service.getIncidentByNumber('o1', 142);

    expect(incident.team).toEqual({ id: 't1', name: 'Platform Team' });
    expect(incident.escalation).toEqual({
      policy: { id: 'p1', name: 'Platform Critical' },
      currentStepPosition: 1,
      round: 0,
      repeatCount: 1,
      nextEscalationAt: null,
      steps: [
        {
          position: 1,
          delayMinutes: 5,
          targetType: 'USER',
          targetName: 'Rahul Verma',
          state: 'notified',
          notifiedUsers: [
            { name: 'Rahul Verma', at: NOW, status: 'DELIVERED' },
          ],
        },
        {
          position: 2,
          delayMinutes: 10,
          targetType: 'SCHEDULE',
          targetName: 'Platform Weekly',
          state: 'pending',
          notifiedUsers: [],
        },
      ],
    });
  });

  it('gives 404 for events and alerts of an incident in another organization', async () => {
    prisma.incident.findFirst.mockResolvedValue(null);

    await expect(service.listEvents('o1', 'i-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.listAlerts('o1', 'i-other', { page: 1, pageSize: 25 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.incident.findFirst).toHaveBeenCalledWith({
      where: { id: 'i-other', organizationId: 'o1' },
    });
  });

  describe('acknowledge', () => {
    it('is refused for a viewer', async () => {
      prisma.membership.findUnique.mockResolvedValue({
        role: 'VIEWER',
        user: { id: 'u1', name: 'Zara' },
      });

      await expect(
        service.acknowledge('u1', 'o1', 'i1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.incident.updateMany).not.toHaveBeenCalled();
    });

    it('puts the status check inside the update, so only one caller can win', async () => {
      await service.acknowledge('u1', 'o1', 'i1');

      const update = (
        prisma.incident.updateMany.mock.calls[0] as [
          { where: unknown; data: Record<string, unknown> },
        ]
      )[0];
      expect(update.where).toEqual({ id: 'i1', status: 'TRIGGERED' });
      expect(update.data.status).toBe('ACKNOWLEDGED');
      expect(update.data.nextEscalationAt).toBeNull();
      expect(escalation.cancel).toHaveBeenCalledWith('i1');
      expect(realtime.emitIncident).toHaveBeenCalledWith(
        'incident.acknowledged',
        'i1',
        { id: 'u1', name: 'Priyanshu Maurya' },
      );
      expect(update.data.acknowledgedById).toBe('u1');
      expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
        data: {
          incidentId: 'i1',
          type: 'ACKNOWLEDGED',
          actorType: 'USER',
          actorId: 'u1',
          message: 'Acknowledged by Priyanshu Maurya',
        },
      });
    });

    it('answers 409 with who got there first when it loses, and logs nothing', async () => {
      prisma.incident.updateMany.mockResolvedValue({ count: 0 });
      prisma.incident.findUniqueOrThrow.mockResolvedValue({
        ...STORED,
        status: 'ACKNOWLEDGED',
        acknowledgedAt: NOW,
        acknowledgedBy: RAHUL,
      });

      const error = await service
        .acknowledge('u1', 'o1', 'i1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        code: 'ALREADY_ACKNOWLEDGED',
        message: 'Already acknowledged by Rahul Verma',
        acknowledgedBy: { id: 'u2', name: 'Rahul Verma' },
        acknowledgedAt: NOW,
        status: 'ACKNOWLEDGED',
      });
      expect(prisma.incidentEvent.create).not.toHaveBeenCalled();
      expect(realtime.emitIncident).not.toHaveBeenCalled();
    });

    it('answers 409 ALREADY_RESOLVED for a resolved incident', async () => {
      prisma.incident.updateMany.mockResolvedValue({ count: 0 });
      prisma.incident.findUniqueOrThrow.mockResolvedValue({
        ...STORED,
        status: 'RESOLVED',
        resolvedAt: NOW,
        resolvedBy: null,
      });

      const error = await service
        .acknowledge('u1', 'o1', 'i1')
        .catch((e: unknown) => e);

      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'ALREADY_RESOLVED',
        message: 'Already resolved',
      });
    });
  });

  describe('resolve', () => {
    it('works from TRIGGERED or ACKNOWLEDGED, with the check inside the update', async () => {
      await service.resolve('u1', 'o1', 'i1', {});

      const update = (
        prisma.incident.updateMany.mock.calls[0] as [
          { where: unknown; data: Record<string, unknown> },
        ]
      )[0];
      expect(update.where).toEqual({
        id: 'i1',
        status: { in: ['TRIGGERED', 'ACKNOWLEDGED'] },
      });
      expect(update.data.resolvedById).toBe('u1');
      expect(eventTypes()).toEqual(['RESOLVED']);
      expect(update.data.nextEscalationAt).toBeNull();
      expect(escalation.cancel).toHaveBeenCalledWith('i1');
      expect(realtime.emitIncident).toHaveBeenCalledWith(
        'incident.resolved',
        'i1',
        { id: 'u1', name: 'Priyanshu Maurya' },
      );
    });

    it('logs the note as a comment before the resolve event', async () => {
      await service.resolve('u1', 'o1', 'i1', { note: 'Pool size increased' });

      expect(eventTypes()).toEqual(['COMMENT', 'RESOLVED']);
    });

    it('is refused for a viewer', async () => {
      prisma.membership.findUnique.mockResolvedValue({
        role: 'VIEWER',
        user: { id: 'u1', name: 'Zara' },
      });

      await expect(
        service.resolve('u1', 'o1', 'i1', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('addNote', () => {
    it('adds a COMMENT event by the current user', async () => {
      const event = await service.addNote('u1', 'o1', 'i1', {
        message: 'Looking into it',
      });

      expect(event).toEqual({
        id: 'e1',
        type: 'COMMENT',
        actorType: 'USER',
        actor: { id: 'u1', name: 'Priyanshu Maurya' },
        message: 'Looking into it',
        metadata: null,
        createdAt: NOW,
      });
    });

    it('is refused for a viewer', async () => {
      prisma.membership.findUnique.mockResolvedValue({
        role: 'VIEWER',
        user: { id: 'u1', name: 'Zara' },
      });

      await expect(
        service.addNote('u1', 'o1', 'i1', { message: 'Hi' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
