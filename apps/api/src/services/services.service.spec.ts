import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma.service';
import { ServicesService } from './services.service';

function createPrismaMock() {
  return {
    service: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    team: { findFirst: jest.fn().mockResolvedValue({ id: 't1' }) },
    escalationPolicy: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
    alert: { findMany: jest.fn().mockResolvedValue([]) },
    incident: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

const STORED = {
  id: 's1',
  name: 'Checkout API',
  description: 'Handles checkout',
  autoResolveMinutes: 30,
  createdAt: new Date('2026-01-05'),
  organizationId: 'o1',
  team: { id: 't1', name: 'Platform Team', slug: 'platform-team' },
  escalationPolicy: { id: 'p1', name: 'Platform Critical', repeatCount: 1 },
  // Open (unresolved) incidents only.
  _count: { incidents: 2 },
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

const CREATE = {
  name: 'Checkout API',
  teamId: 't1',
  escalationPolicyId: 'p1',
};

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let members: { assertCanManageMembers: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    members = { assertCanManageMembers: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembersService, useValue: members },
      ],
    }).compile();
    service = moduleRef.get(ServicesService);
  });

  describe('listServices', () => {
    it('returns each service with its team and policy, and nothing extra', async () => {
      prisma.service.findMany.mockResolvedValue([STORED]);

      await expect(service.listServices('o1')).resolves.toEqual({
        data: [SHAPE],
      });
      const query = prisma.service.findMany.mock.calls[0] as [
        { where: unknown },
      ];
      expect(query[0].where).toEqual({ organizationId: 'o1' });
    });
  });

  describe('getService', () => {
    it('throws 404 for a service in another organization', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(service.getService('o1', 's-other')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('adds recentAlerts to the list shape', async () => {
      prisma.service.findFirst.mockResolvedValue(STORED);

      await expect(service.getService('o1', 's1')).resolves.toEqual({
        ...SHAPE,
        recentAlerts: [],
      });
    });

    it('labels each recent alert as new or dedup', async () => {
      prisma.service.findFirst.mockResolvedValue(STORED);
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
  });

  describe('createService', () => {
    beforeEach(() => prisma.service.create.mockResolvedValue(STORED));

    it('is refused for someone who cannot manage the organization', async () => {
      members.assertCanManageMembers.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.createService('u9', 'o1', CREATE),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('gives 400 when the team is not in this organization', async () => {
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(service.createService('u1', 'o1', CREATE)).rejects.toThrow(
        new BadRequestException('Team not found in your organization'),
      );
      // The lookup includes the organization, which is what makes another
      // organization's team id look like it doesn't exist.
      const query = prisma.team.findFirst.mock.calls[0] as [{ where: unknown }];
      expect(query[0].where).toEqual({ id: 't1', organizationId: 'o1' });
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('gives 400 when the policy is not in this organization', async () => {
      prisma.escalationPolicy.findFirst.mockResolvedValue(null);

      await expect(
        service.createService('u1', 'o1', CREATE),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('gives 409 when the name is already used', async () => {
      prisma.service.count.mockResolvedValue(1);

      await expect(
        service.createService('u1', 'o1', CREATE),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('stores "no description" and "never auto-resolve" as null', async () => {
      await service.createService('u1', 'o1', CREATE);

      const created = prisma.service.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(created[0].data).toEqual({
        name: 'Checkout API',
        description: null,
        autoResolveMinutes: null,
        organizationId: 'o1',
        teamId: 't1',
        escalationPolicyId: 'p1',
      });
    });
  });

  describe('updateService', () => {
    beforeEach(() => {
      prisma.service.findFirst.mockResolvedValue(STORED);
      prisma.service.update.mockResolvedValue(STORED);
    });

    it('only checks the fields that were sent', async () => {
      await service.updateService('u1', 'o1', 's1', { description: 'New' });

      expect(prisma.team.findFirst).not.toHaveBeenCalled();
      expect(prisma.escalationPolicy.findFirst).not.toHaveBeenCalled();
      expect(prisma.service.count).not.toHaveBeenCalled();
    });

    it('can turn auto-resolve off with null', async () => {
      await service.updateService('u1', 'o1', 's1', {
        autoResolveMinutes: null,
      });

      const updated = prisma.service.update.mock.calls[0] as [
        { data: { autoResolveMinutes: unknown; name: unknown } },
      ];
      expect(updated[0].data.autoResolveMinutes).toBeNull();
      expect(updated[0].data.name).toBeUndefined();
    });

    it('gives 400 when moved to a team outside this organization', async () => {
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(
        service.updateService('u1', 'o1', 's1', { teamId: 't-other' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('does not check the name against itself', async () => {
      await service.updateService('u1', 'o1', 's1', { name: 'Checkout API' });

      expect(prisma.service.count).not.toHaveBeenCalled();
    });
  });

  describe('deleteService', () => {
    it('throws 404 for a service in another organization', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteService('u1', 'o1', 's-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.service.delete).not.toHaveBeenCalled();
    });

    it('refuses with 409 while the service has open incidents', async () => {
      prisma.service.findFirst.mockResolvedValue(STORED);
      prisma.incident.findMany.mockResolvedValue([{ id: 'i1', number: 4 }]);

      const error = await service
        .deleteService('u1', 'o1', 's1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        message: 'Service has 1 open incident',
        incidents: [{ id: 'i1', number: 4, name: 'INC-4' }],
      });
      expect(prisma.service.delete).not.toHaveBeenCalled();
    });

    it('deletes the service', async () => {
      prisma.service.findFirst.mockResolvedValue(STORED);

      await service.deleteService('u1', 'o1', 's1');

      expect(prisma.service.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });
  });
});
