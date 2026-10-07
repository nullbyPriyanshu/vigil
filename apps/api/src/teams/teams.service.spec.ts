import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma.service';
import { SchedulesService } from '../schedules/schedules.service';
import { TeamsService } from './teams.service';

const TEAM = {
  id: 't1',
  name: 'Platform Team',
  slug: 'platform-team',
  members: [{ userId: 'u1' }, { userId: 'u2' }],
  services: [] as { id: string; name: string }[],
  schedules: [] as { id: string; name: string }[],
};

function createPrismaMock() {
  return {
    team: {
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(TEAM),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 't1' }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    membership: {
      findMany: jest.fn().mockResolvedValue([
        {
          userId: 'u2',
          role: 'ADMIN',
          user: { name: 'Rahul Verma', email: 'rahul@acme.com' },
        },
        {
          userId: 'u1',
          role: 'OWNER',
          user: { name: 'Priyanshu Maurya', email: 'p@acme.com' },
        },
      ]),
      findUnique: jest
        .fn()
        .mockResolvedValue({ user: { name: 'Sneha Kapoor' } }),
      count: jest.fn().mockResolvedValue(0),
    },
    teamMember: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    schedule: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let members: { assertCanManageMembers: jest.Mock };
  let schedules: { removeFromRotation: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    members = { assertCanManageMembers: jest.fn() };
    schedules = { removeFromRotation: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembersService, useValue: members },
        { provide: SchedulesService, useValue: schedules },
      ],
    }).compile();
    service = moduleRef.get(TeamsService);
  });

  it('lists teams with counts and the first five members by name', async () => {
    const names = [
      'Zara Khan',
      'Aman Gupta',
      'Maya Chen',
      'Daniel Okafor',
      'Lena Fischer',
      'Priyanshu',
    ];
    prisma.team.findMany.mockResolvedValue([
      {
        ...TEAM,
        members: names.map((name, i) => ({ user: { id: `u${i}`, name } })),
        services: [{ id: 's1' }],
      },
    ]);

    const result = await service.listTeams('o1');

    expect(result.data[0]).toMatchObject({ memberCount: 6, serviceCount: 1 });
    expect(result.data[0].members.map((m) => m.initials)).toEqual([
      'AG',
      'DO',
      'LF',
      'MC',
      'P',
    ]);
  });

  it('shows a team with members by name, each with their organization role', async () => {
    prisma.team.findFirst.mockResolvedValue({
      ...TEAM,
      services: [{ id: 's1', name: 'Checkout API', teamId: 't1' }],
      schedules: [{ id: 'sc1', name: 'Platform Weekly', timezone: 'UTC' }],
    });

    const team = await service.getTeam('o1', 't1');

    expect(team.members.map((m) => `${m.name}:${m.role}`)).toEqual([
      'Priyanshu Maurya:OWNER',
      'Rahul Verma:ADMIN',
    ]);
    expect(team.services).toEqual([{ id: 's1', name: 'Checkout API' }]);
    expect(team.schedules).toEqual([{ id: 'sc1', name: 'Platform Weekly' }]);
  });

  it('gives 404 for a team in another organization', async () => {
    prisma.team.findFirst.mockResolvedValue(null);

    await expect(service.getTeam('o1', 't-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('createTeam', () => {
    it('is refused for someone who cannot manage members', async () => {
      members.assertCanManageMembers.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.createTeam('u1', 'o1', { name: 'A team' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates the team with a slug and its first members', async () => {
      prisma.membership.count.mockResolvedValue(2);

      await service.createTeam('u1', 'o1', {
        name: 'Platform Team',
        memberIds: ['u1', 'u2'],
      });

      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          name: 'Platform Team',
          slug: 'platform-team',
          organizationId: 'o1',
          members: { create: [{ userId: 'u1' }, { userId: 'u2' }] },
        },
      });
    });

    it('gives 400 when a chosen member is not in the organization', async () => {
      prisma.membership.count.mockResolvedValue(1);

      await expect(
        service.createTeam('u1', 'o1', {
          name: 'A team',
          memberIds: ['u1', 'u9'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('gives 409 when the slug is taken, and 400 for a name with no letters', async () => {
      prisma.team.findUnique.mockResolvedValue({
        id: 't0',
        name: 'Platform team',
      });
      await expect(
        service.createTeam('u1', 'o1', { name: 'platform  TEAM' }),
      ).rejects.toBeInstanceOf(ConflictException);

      await expect(
        service.createTeam('u1', 'o1', { name: '!!!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('lets a team keep its own slug when renamed', async () => {
    prisma.team.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Platform Team',
    });

    await service.updateTeam('u1', 'o1', 't1', { name: 'Platform team' });

    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { name: 'Platform team', slug: 'platform-team' },
    });
  });

  describe('deleteTeam', () => {
    it('gives 409 while the team owns services or schedules', async () => {
      prisma.team.findFirst.mockResolvedValue({
        ...TEAM,
        services: [{ id: 's1', name: 'Checkout API' }],
      });
      const first = await service
        .deleteTeam('u1', 'o1', 't1')
        .catch((e: unknown) => e);
      expect((first as ConflictException).getResponse()).toEqual({
        message: 'Team owns 1 service',
        services: [{ id: 's1', name: 'Checkout API' }],
      });

      prisma.team.findFirst.mockResolvedValue({
        ...TEAM,
        schedules: [
          { id: 'sc1', name: 'Weekly' },
          { id: 'sc2', name: 'Daily' },
        ],
      });
      const second = await service
        .deleteTeam('u1', 'o1', 't1')
        .catch((e: unknown) => e);
      expect((second as ConflictException).getResponse()).toMatchObject({
        message: 'Team owns 2 schedules',
      });

      expect(prisma.team.delete).not.toHaveBeenCalled();
    });

    it('deletes an empty team', async () => {
      await service.deleteTeam('u1', 'o1', 't1');

      expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    });
  });

  describe('addTeamMember', () => {
    it('gives 400 for someone outside the organization', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);

      await expect(
        service.addTeamMember('u1', 'o1', 't1', { userId: 'u9' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('adds the member, and adding them again changes nothing', async () => {
      await expect(
        service.addTeamMember('u1', 'o1', 't1', { userId: 'u3' }),
      ).resolves.toEqual({
        teamId: 't1',
        userId: 'u3',
        name: 'Sneha Kapoor',
      });
      expect(prisma.teamMember.create).toHaveBeenCalledTimes(1);

      prisma.teamMember.findUnique.mockResolvedValue({ id: 'tm1' });
      await service.addTeamMember('u1', 'o1', 't1', { userId: 'u3' });
      expect(prisma.teamMember.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeTeamMember', () => {
    it('removes someone who is on no schedule', async () => {
      await service.removeTeamMember('u1', 'o1', 't1', 'u2', false);

      expect(prisma.teamMember.deleteMany).toHaveBeenCalledWith({
        where: { teamId: 't1', userId: 'u2' },
      });
    });

    it('gives 409 listing the schedules when they are on call somewhere', async () => {
      prisma.schedule.findMany.mockResolvedValue([
        { id: 'sc1', name: 'Platform Weekly' },
      ]);

      const error = await service
        .removeTeamMember('u1', 'o1', 't1', 'u2', false)
        .catch((e: unknown) => e);

      expect((error as ConflictException).getResponse()).toEqual({
        message: 'User is on 1 schedule',
        schedules: [{ id: 'sc1', name: 'Platform Weekly' }],
      });
      expect(prisma.teamMember.deleteMany).not.toHaveBeenCalled();
    });

    it('with force, takes them off those schedules first', async () => {
      prisma.schedule.findMany.mockResolvedValue([
        { id: 'sc1', name: 'Platform Weekly' },
      ]);

      await service.removeTeamMember('u1', 'o1', 't1', 'u2', true);

      expect(schedules.removeFromRotation).toHaveBeenCalledWith('sc1', 'u2');
      expect(prisma.teamMember.deleteMany).toHaveBeenCalled();
    });
  });
});
