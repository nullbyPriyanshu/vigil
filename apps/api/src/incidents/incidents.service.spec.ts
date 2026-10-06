import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EscalationPoliciesService } from '../escalation-policies/escalation-policies.service';
import { PrismaService } from '../prisma.service';
import { IncidentsService } from './incidents.service';

const NOW = new Date('2026-01-12T21:44:00.000Z');

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
  organizationId: 'o1',
  service: {
    id: 's1',
    name: 'Checkout API',
    escalationPolicyId: 'p1',
    team: { id: 't1', name: 'Platform Team' },
    escalationPolicy: { _count: { steps: 2 } },
  },
  _count: { alerts: 12 },
};

const POLICY = {
  id: 'p1',
  name: 'Platform Critical',
  repeatCount: 1,
  steps: [
    {
      position: 1,
      delayMinutes: 5,
      targetType: 'USER',
      target: { id: 'u2', name: 'Rahul Verma' },
    },
    {
      position: 2,
      delayMinutes: 10,
      targetType: 'TEAM',
      target: { id: 't1', name: 'Platform Team' },
    },
  ],
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
        actor: { id: 'u1', name: 'Priyanshu Maurya' },
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

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EscalationPoliciesService,
          useValue: { getPolicy: jest.fn().mockResolvedValue(POLICY) },
        },
      ],
    }).compile();
    service = moduleRef.get(IncidentsService);
  });

  const eventTypes = () =>
    (
      prisma.incidentEvent.create.mock.calls as [{ data: { type: string } }][]
    ).map((call) => call[0].data.type);

  describe('listIncidents', () => {
    it('returns a row with everything the list needs, and page info', async () => {
      prisma.incident.count.mockResolvedValue(142);

      const result = await service.listIncidents('o1', {
        page: 1,
        pageSize: 25,
      });

      expect(result.data[0]).toEqual({
        id: 'i1',
        number: 142,
        title: 'Pool exhausted',
        severity: 'CRITICAL',
        status: 'TRIGGERED',
        service: { id: 's1', name: 'Checkout API' },
        alertCount: 12,
        currentStepPosition: 1,
        totalSteps: 2,
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolvedBy: null,
        resolvedAt: null,
        lastAlertAt: NOW,
        createdAt: NOW,
      });
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 25,
        total: 142,
        totalPages: 6,
      });
    });

    it('applies the filters and the page, newest first, inside this organization', async () => {
      await service.listIncidents('o1', {
        page: 3,
        pageSize: 10,
        status: 'TRIGGERED',
        severity: 'CRITICAL',
        service: 's1',
      });

      const query = prisma.incident.findMany.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(query[0].where).toEqual({
        organizationId: 'o1',
        status: 'TRIGGERED',
        severity: 'CRITICAL',
        serviceId: 's1',
      });
      expect(query[0].orderBy).toEqual({ createdAt: 'desc' });
      expect(query[0].skip).toBe(20);
      expect(query[0].take).toBe(10);
    });
  });

  describe('getIncidentByNumber', () => {
    it('looks the number up inside this organization only', async () => {
      prisma.incident.findUnique.mockResolvedValue(null);

      await expect(
        service.getIncidentByNumber('o1', 999),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.incident.findUnique).toHaveBeenCalledWith({
        where: { organizationId_number: { organizationId: 'o1', number: 999 } },
      });
    });

    it('includes the service, team and escalation steps by name', async () => {
      const incident = await service.getIncidentByNumber('o1', 142);

      expect(incident.service).toEqual({ id: 's1', name: 'Checkout API' });
      expect(incident.team).toEqual({ id: 't1', name: 'Platform Team' });
      expect(incident.alertCount).toBe(12);
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
            state: 'pending',
            notifiedUsers: [],
          },
          {
            position: 2,
            delayMinutes: 10,
            targetType: 'TEAM',
            targetName: 'Platform Team',
            state: 'pending',
            notifiedUsers: [],
          },
        ],
      });
    });
  });

  describe('listEvents / listAlerts', () => {
    it('throw 404 for an incident in another organization', async () => {
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

    it('returns the timeline oldest first', async () => {
      await service.listEvents('o1', 'i1');

      const query = prisma.incidentEvent.findMany.mock.calls[0] as [
        { orderBy: unknown },
      ];
      expect(query[0].orderBy).toEqual({ createdAt: 'asc' });
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

      const update = prisma.incident.updateMany.mock.calls[0] as [
        { where: unknown; data: { status: string; acknowledgedById: string } },
      ];
      expect(update[0].where).toEqual({ id: 'i1', status: 'TRIGGERED' });
      expect(update[0].data.status).toBe('ACKNOWLEDGED');
      expect(update[0].data.acknowledgedById).toBe('u1');
    });

    it('logs the event and returns the full incident when it wins', async () => {
      const result = await service.acknowledge('u1', 'o1', 'i1');

      expect(result.incident.number).toBe(142);
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
        acknowledgedBy: { id: 'u2', name: 'Rahul Verma' },
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
    });

    it('answers 409 ALREADY_RESOLVED for a resolved incident', async () => {
      prisma.incident.updateMany.mockResolvedValue({ count: 0 });
      prisma.incident.findUniqueOrThrow.mockResolvedValue({
        ...STORED,
        status: 'RESOLVED',
        resolvedAt: NOW,
        resolvedBy: { id: 'u3', name: 'Sneha Kapoor' },
      });

      const error = await service
        .acknowledge('u1', 'o1', 'i1')
        .catch((e: unknown) => e);

      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'ALREADY_RESOLVED',
        resolvedBy: { id: 'u3', name: 'Sneha Kapoor' },
      });
    });
  });

  describe('resolve', () => {
    it('works from TRIGGERED or ACKNOWLEDGED, with the check inside the update', async () => {
      await service.resolve('u1', 'o1', 'i1', {});

      const update = prisma.incident.updateMany.mock.calls[0] as [
        { where: unknown; data: { status: string; resolvedById: string } },
      ];
      expect(update[0].where).toEqual({
        id: 'i1',
        status: { in: ['TRIGGERED', 'ACKNOWLEDGED'] },
      });
      expect(update[0].data.status).toBe('RESOLVED');
      expect(update[0].data.resolvedById).toBe('u1');
      expect(eventTypes()).toEqual(['RESOLVED']);
    });

    it('logs the note as a comment before the resolve event', async () => {
      await service.resolve('u1', 'o1', 'i1', { note: 'Pool size increased' });

      expect(eventTypes()).toEqual(['COMMENT', 'RESOLVED']);
    });

    it('answers 409 ALREADY_RESOLVED when someone else resolved it first', async () => {
      prisma.incident.updateMany.mockResolvedValue({ count: 0 });
      prisma.incident.findUniqueOrThrow.mockResolvedValue({
        ...STORED,
        status: 'RESOLVED',
        resolvedAt: NOW,
        resolvedBy: null,
      });

      const error = await service
        .resolve('u1', 'o1', 'i1', {})
        .catch((e: unknown) => e);

      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'ALREADY_RESOLVED',
        message: 'Already resolved',
      });
      expect(prisma.incidentEvent.create).not.toHaveBeenCalled();
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

    it('is refused for a viewer, and for an incident in another organization', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);
      await expect(
        service.addNote('u1', 'o1', 'i-other', { message: 'Hi' }),
      ).rejects.toBeInstanceOf(NotFoundException);

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
