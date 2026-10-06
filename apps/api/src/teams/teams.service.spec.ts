import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma.service';
import { TeamsService } from './teams.service';

function createPrismaMock() {
  return {
    team: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    teamMember: { upsert: jest.fn(), deleteMany: jest.fn() },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    membership: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };
}

const TEAM = {
  id: 't1',
  name: 'Platform Team',
  slug: 'platform-team',
  organizationId: 'o1',
};

const person = (id: string, name: string) => ({
  user: { id, name, email: `${id}@acme.com` },
});

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let members: { assertCanManageMembers: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    members = { assertCanManageMembers: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembersService, useValue: members },
      ],
    }).compile();
    service = moduleRef.get(TeamsService);
  });

  describe('listTeams', () => {
    it('returns counts and a short preview with initials', async () => {
      prisma.team.findMany.mockResolvedValue([
        {
          ...TEAM,
          _count: { services: 2 },
          members: [
            person('u2', 'Sneha Kapoor'),
            person('u1', 'Rahul Verma'),
            person('u3', 'Priyanshu'),
            person('u4', 'Aman Gupta'),
            person('u5', 'Maya Chen'),
            person('u6', 'Zara Khan'),
          ],
        },
      ]);

      const { data } = await service.listTeams('o1');

      expect(data[0]).toMatchObject({
        id: 't1',
        name: 'Platform Team',
        slug: 'platform-team',
        memberCount: 6,
        serviceCount: 2,
      });
      // Five at most, in name order.
      expect(data[0].members.map((m) => m.initials)).toEqual([
        'AG',
        'MC',
        'P',
        'RV',
        'SK',
      ]);
      expect(Object.keys(data[0].members[0]).sort()).toEqual([
        'initials',
        'name',
        'userId',
      ]);
    });

    it('only asks for teams in the caller’s organization', async () => {
      prisma.team.findMany.mockResolvedValue([]);

      await expect(service.listTeams('o1')).resolves.toEqual({ data: [] });
      const query = prisma.team.findMany.mock.calls[0] as [{ where: unknown }];
      expect(query[0].where).toEqual({ organizationId: 'o1' });
    });
  });

  describe('getTeam', () => {
    it('throws 404 for a team in another organization', async () => {
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(service.getTeam('o1', 't-other')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      const query = prisma.team.findFirst.mock.calls[0] as [{ where: unknown }];
      expect(query[0].where).toEqual({ id: 't-other', organizationId: 'o1' });
    });

    it('returns members with their role, plus services and schedules', async () => {
      prisma.team.findFirst.mockResolvedValue(TEAM);
      prisma.membership.findMany.mockResolvedValue([
        { userId: 'u1', role: 'ADMIN', ...person('u1', 'Rahul Verma') },
      ]);

      await expect(service.getTeam('o1', 't1')).resolves.toEqual({
        id: 't1',
        name: 'Platform Team',
        slug: 'platform-team',
        members: [
          {
            userId: 'u1',
            name: 'Rahul Verma',
            email: 'u1@acme.com',
            role: 'ADMIN',
          },
        ],
        services: [],
        schedules: [],
      });
    });
  });

  describe('createTeam', () => {
    beforeEach(() => {
      prisma.team.findUnique.mockResolvedValue(null);
      prisma.team.create.mockResolvedValue(TEAM);
      prisma.team.findFirst.mockResolvedValue(TEAM);
    });

    it('is refused for someone who cannot manage members', async () => {
      members.assertCanManageMembers.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.createTeam('u9', 'o1', { name: 'Platform Team' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it('derives the slug from the name', async () => {
      await service.createTeam('u1', 'o1', { name: 'Platform & Infra' });

      const created = prisma.team.create.mock.calls[0] as [
        { data: { slug: string; organizationId: string } },
      ];
      expect(created[0].data.slug).toBe('platform-infra');
      expect(created[0].data.organizationId).toBe('o1');
    });

    it('rejects a name with no letters or numbers', async () => {
      await expect(
        service.createTeam('u1', 'o1', { name: '!!!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('gives 409 when the slug is already used in this organization', async () => {
      prisma.team.findUnique.mockResolvedValue({ ...TEAM, id: 't-existing' });

      await expect(
        service.createTeam('u1', 'o1', { name: 'Platform Team' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it('gives 400 when a chosen member is not in the organization', async () => {
      prisma.membership.count.mockResolvedValue(1);

      await expect(
        service.createTeam('u1', 'o1', {
          name: 'Platform Team',
          memberIds: ['u1', 'outsider'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it('creates the team with its first members', async () => {
      prisma.membership.count.mockResolvedValue(2);

      await service.createTeam('u1', 'o1', {
        name: 'Platform Team',
        memberIds: ['u1', 'u2'],
      });

      const created = prisma.team.create.mock.calls[0] as [
        { data: { members: { create: { userId: string }[] } } },
      ];
      expect(created[0].data.members.create).toEqual([
        { userId: 'u1' },
        { userId: 'u2' },
      ]);
    });
  });

  describe('updateTeam', () => {
    beforeEach(() => prisma.team.findFirst.mockResolvedValue(TEAM));

    it('regenerates the slug from the new name', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await service.updateTeam('u1', 'o1', 't1', { name: 'Platform & Infra' });

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { name: 'Platform & Infra', slug: 'platform-infra' },
      });
    });

    it('lets a team keep its own slug (e.g. only the capitals changed)', async () => {
      prisma.team.findUnique.mockResolvedValue(TEAM);

      await service.updateTeam('u1', 'o1', 't1', { name: 'PLATFORM TEAM' });

      expect(prisma.team.update).toHaveBeenCalled();
    });

    it('gives 409 when another team already has that slug', async () => {
      prisma.team.findUnique.mockResolvedValue({ ...TEAM, id: 't2' });

      await expect(
        service.updateTeam('u1', 'o1', 't1', { name: 'Platform Team' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('deleteTeam', () => {
    it('throws 404 for a team in another organization', async () => {
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteTeam('u1', 'o1', 't-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.team.delete).not.toHaveBeenCalled();
    });

    it('gives 409 and lists the services while the team still owns some', async () => {
      prisma.team.findFirst.mockResolvedValue(TEAM);
      prisma.service.findMany.mockResolvedValue([
        { id: 's1', name: 'Checkout API' },
        { id: 's2', name: 'Payments API' },
      ]);

      const error = await service
        .deleteTeam('u1', 'o1', 't1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        message: 'Team owns 2 services',
        services: [
          { id: 's1', name: 'Checkout API' },
          { id: 's2', name: 'Payments API' },
        ],
      });
      expect(prisma.team.delete).not.toHaveBeenCalled();
    });

    it('deletes the team', async () => {
      prisma.team.findFirst.mockResolvedValue(TEAM);

      await service.deleteTeam('u1', 'o1', 't1');

      expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    });
  });

  describe('addTeamMember', () => {
    beforeEach(() => prisma.team.findFirst.mockResolvedValue(TEAM));

    it('gives 400 for someone outside the organization', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);

      await expect(
        service.addTeamMember('u1', 'o1', 't1', { userId: 'outsider' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.teamMember.upsert).not.toHaveBeenCalled();
    });

    it('adds the member, and adding them again changes nothing', async () => {
      prisma.membership.findUnique.mockResolvedValue({
        user: { name: 'Sneha Kapoor' },
      });

      const result = await service.addTeamMember('u1', 'o1', 't1', {
        userId: 'u2',
      });

      expect(result).toEqual({
        teamId: 't1',
        userId: 'u2',
        name: 'Sneha Kapoor',
      });
      // upsert with an empty update is what makes a repeat a no-op.
      expect(prisma.teamMember.upsert).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: 't1', userId: 'u2' } },
        create: { teamId: 't1', userId: 'u2' },
        update: {},
      });
    });
  });

  describe('removeTeamMember', () => {
    it('removes them from this team only', async () => {
      prisma.team.findFirst.mockResolvedValue(TEAM);

      await service.removeTeamMember('u1', 'o1', 't1', 'u2', false);

      expect(prisma.teamMember.deleteMany).toHaveBeenCalledWith({
        where: { teamId: 't1', userId: 'u2' },
      });
    });

    it('throws 404 when the team is not in this organization', async () => {
      prisma.team.findFirst.mockResolvedValue(null);

      await expect(
        service.removeTeamMember('u1', 'o1', 't-other', 'u2', false),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
