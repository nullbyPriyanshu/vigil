import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AlertsService } from '../alerts/alerts.service';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma.service';
import { ServicesService } from './services.service';

jest.mock('../alerts/alerts.service', () => ({ AlertsService: class {} }));

const STORED = {
  id: 's1',
  name: 'Checkout API',
  description: 'Handles checkout',
  autoResolveMinutes: 30,
  createdAt: new Date('2026-01-05'),
  organizationId: 'o1',
  team: { id: 't1', name: 'Platform Team', slug: 'platform-team' },
  escalationPolicy: { id: 'p1', name: 'Platform Critical', repeatCount: 1 },
};

const SHAPE = {
  id: 's1',
  name: 'Checkout API',
  description: 'Handles checkout',
  team: { id: 't1', name: 'Platform Team' },
  escalationPolicy: { id: 'p1', name: 'Platform Critical' },
  autoResolveMinutes: 30,
  openIncidentCount: 2,
  createdAt: STORED.createdAt,
};

const CREATE = { name: 'Checkout API', teamId: 't1', escalationPolicyId: 'p1' };

function createPrismaMock() {
  return {
    service: {
      findMany: jest.fn().mockResolvedValue([STORED]),
      findFirst: jest.fn().mockResolvedValue(STORED),
      create: jest.fn().mockResolvedValue({ id: 's1' }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    team: { findFirst: jest.fn().mockResolvedValue({ id: 't1' }) },
    membership: {
      findUnique: jest.fn().mockResolvedValue({ role: 'RESPONDER' }),
    },
    escalationPolicy: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
    alert: { findMany: jest.fn().mockResolvedValue([]) },
    incident: {
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let members: { assertCanManageMembers: jest.Mock };
  let alerts: { createAlert: jest.Mock };

  const nameIsFree = () =>
    prisma.service.findFirst.mockImplementation(
      ({ where }: { where: { name?: unknown } }) =>
        where.name ? null : STORED,
    );

  beforeEach(async () => {
    prisma = createPrismaMock();
    members = { assertCanManageMembers: jest.fn() };
    alerts = {
      createAlert: jest.fn().mockResolvedValue({
        created: true,
        body: { alert_id: 'a1', incident_id: 'i1', incident_number: 7 },
      }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembersService, useValue: members },
        { provide: AlertsService, useValue: alerts },
      ],
    }).compile();
    service = moduleRef.get(ServicesService);
  });

  it('lists services with their team, policy and open incident count', async () => {
    prisma.incident.findMany.mockResolvedValue([
      { serviceId: 's1' },
      { serviceId: 's1' },
      { serviceId: 's-other' },
    ]);

    await expect(service.listServices('o1')).resolves.toEqual({
      data: [SHAPE],
    });
  });

  it('gives 404 for a service in another organization', async () => {
    prisma.service.findFirst.mockResolvedValue(null);

    await expect(service.getService('o1', 's-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('labels each recent alert as new or dedup', async () => {
    const receivedAt = new Date('2026-01-12');
    prisma.alert.findMany.mockResolvedValue([
      {
        id: 'a2',
        title: 'Pool full',
        receivedAt,
        deduplicated: true,
        incident: { number: 7 },
      },
      {
        id: 'a1',
        title: 'Pool full',
        receivedAt,
        deduplicated: false,
        incident: { number: 7 },
      },
      {
        id: 'a0',
        title: 'All clear',
        receivedAt,
        deduplicated: false,
        incident: null,
      },
    ]);

    const result = await service.getService('o1', 's1');

    expect(result).toMatchObject(SHAPE);
    expect(result.recentAlerts).toEqual([
      {
        id: 'a2',
        title: 'Pool full',
        receivedAt,
        incidentNumber: 7,
        kind: 'dedup',
      },
      {
        id: 'a1',
        title: 'Pool full',
        receivedAt,
        incidentNumber: 7,
        kind: 'new',
      },
      {
        id: 'a0',
        title: 'All clear',
        receivedAt,
        incidentNumber: null,
        kind: 'new',
      },
    ]);
  });

  describe('createService', () => {
    it('is refused for someone who cannot manage the organization', async () => {
      members.assertCanManageMembers.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.createService('u1', 'o1', CREATE),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('gives 400 for a team or policy outside this organization', async () => {
      prisma.team.findFirst.mockResolvedValue(null);
      await expect(service.createService('u1', 'o1', CREATE)).rejects.toThrow(
        'Team not found in your organization',
      );
      expect(prisma.team.findFirst).toHaveBeenCalledWith({
        where: { id: 't1', organizationId: 'o1' },
      });

      prisma.team.findFirst.mockResolvedValue({ id: 't1' });
      prisma.escalationPolicy.findFirst.mockResolvedValue(null);
      await expect(
        service.createService('u1', 'o1', CREATE),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('gives 409 when the name is already used', async () => {
      await expect(
        service.createService('u1', 'o1', CREATE),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('stores "no description" and "never auto-resolve" as null', async () => {
      nameIsFree();

      await service.createService('u1', 'o1', CREATE);

      expect(prisma.service.create).toHaveBeenCalledWith({
        data: {
          name: 'Checkout API',
          description: null,
          autoResolveMinutes: null,
          organizationId: 'o1',
          teamId: 't1',
          escalationPolicyId: 'p1',
        },
      });
    });
  });

  describe('updateService', () => {
    it('only checks the fields that were sent', async () => {
      await service.updateService('u1', 'o1', 's1', { description: 'New' });

      expect(prisma.team.findFirst).not.toHaveBeenCalled();
      expect(prisma.escalationPolicy.findFirst).not.toHaveBeenCalled();
      expect(prisma.service.findFirst).toHaveBeenCalledTimes(2);
    });

    it('can turn auto-resolve off with null', async () => {
      await service.updateService('u1', 'o1', 's1', {
        autoResolveMinutes: null,
      });

      const data = (
        prisma.service.update.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;
      expect(data.autoResolveMinutes).toBeNull();
      expect(data.name).toBeUndefined();
    });

    it('gives 400 when moved to a team outside this organization', async () => {
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(
        service.updateService('u1', 'o1', 's1', { teamId: 't-other' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteService', () => {
    it('refuses with 409 while the service has open incidents', async () => {
      prisma.incident.findMany.mockResolvedValue([{ id: 'i1', number: 4 }]);

      const error = await service
        .deleteService('u1', 'o1', 's1')
        .catch((e: unknown) => e);

      expect((error as ConflictException).getResponse()).toEqual({
        message: 'Service has 1 open incident',
        incidents: [{ id: 'i1', number: 4, name: 'INC-4' }],
      });
      expect(prisma.service.delete).not.toHaveBeenCalled();
    });

    it('deletes the service', async () => {
      await service.deleteService('u1', 'o1', 's1');

      expect(prisma.service.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });
  });

  describe('sendTestAlert', () => {
    it('sends a real alert through the same pipeline, without an API key', async () => {
      const result = await service.sendTestAlert('u1', 'o1', 's1', 'HIGH');

      const call = alerts.createAlert.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(call[0]).toEqual({ serviceId: 's1', organizationId: 'o1' });
      expect(call[1]).toMatchObject({
        title: 'Test alert for Checkout API',
        dedup_key: 'vigil-test-alert',
        severity: 'high',
      });
      expect(result).toEqual({
        alertId: 'a1',
        incidentId: 'i1',
        incidentNumber: 7,
        deduplicated: false,
      });
    });

    it('is refused for a viewer', async () => {
      prisma.membership.findUnique.mockResolvedValue({ role: 'VIEWER' });

      await expect(
        service.sendTestAlert('u1', 'o1', 's1', 'HIGH'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(alerts.createAlert).not.toHaveBeenCalled();
    });
  });
});
