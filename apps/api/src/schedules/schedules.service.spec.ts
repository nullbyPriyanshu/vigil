import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma.service';
import { SchedulesService } from './schedules.service';

const person = (position: number, userId: string, name: string) => ({
  id: `sp${position}`,
  position,
  userId,
  user: { id: userId, name, email: `${userId}@acme.com` },
});

const SCHEDULE = {
  id: 'sc1',
  name: 'Platform Weekly',
  timezone: 'Asia/Kolkata',
  rotationType: 'WEEKLY' as const,
  handoffDay: 1,
  handoffTime: '10:00',
  startDate: new Date('2026-01-05T04:30:00.000Z'),
  organizationId: 'o1',
  teamId: 't1',
  team: { id: 't1', name: 'Platform Team' },
  participants: [
    person(0, 'u1', 'Priyanshu Maurya'),
    person(1, 'u2', 'Rahul Verma'),
    person(2, 'u3', 'Sneha Kapoor'),
  ],
};

const CREATE = {
  name: 'Platform Weekly',
  teamId: 't1',
  timezone: 'Asia/Kolkata',
  rotationType: 'WEEKLY' as const,
  handoffDay: 1,
  handoffTime: '10:00',
  startDate: '2026-01-05',
};

function createPrismaMock() {
  const mock = {
    schedule: {
      findMany: jest.fn().mockResolvedValue([SCHEDULE]),
      findFirst: jest.fn().mockResolvedValue(SCHEDULE),
      findUnique: jest.fn().mockResolvedValue(SCHEDULE),
      create: jest.fn().mockResolvedValue({ id: 'sc1' }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    scheduleParticipant: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => data),
      update: jest.fn(({ data }: { data: unknown }) => data),
      deleteMany: jest.fn(),
    },
    team: { findFirst: jest.fn().mockResolvedValue({ id: 't1' }) },
    membership: {
      findUnique: jest.fn().mockResolvedValue({
        role: 'RESPONDER',
        user: { id: 'u4', name: 'Amit Sharma' },
      }),
    },
    teamMember: { findUnique: jest.fn().mockResolvedValue({ id: 'tm1' }) },
    escalationPolicy: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((queries: unknown[]) => Promise.all(queries)),
  };
  return mock;
}

describe('SchedulesService', () => {
  let service: SchedulesService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const nameIsFree = () =>
    prisma.schedule.findFirst.mockImplementation(
      ({ where }: { where: { name?: unknown } }) =>
        where.name ? null : SCHEDULE,
    );

  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-01-14T00:00:00.000Z'));
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: MembersService,
          useValue: { assertCanManageMembers: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(SchedulesService);
  });

  afterEach(() => jest.useRealTimers());

  it('lists schedules with who is on call now and until when', async () => {
    const result = await service.listSchedules('o1');

    expect(result.data[0]).toEqual({
      id: 'sc1',
      name: 'Platform Weekly',
      team: { id: 't1', name: 'Platform Team' },
      timezone: 'Asia/Kolkata',
      rotationType: 'WEEKLY',
      handoffDay: 1,
      handoffTime: '10:00',
      participantCount: 3,
      currentOnCall: {
        userId: 'u2',
        name: 'Rahul Verma',
        until: new Date('2026-01-19T04:30:00.000Z'),
        nextName: 'Sneha Kapoor',
      },
    });
  });

  it('has nobody on call before the start date or with no participants', async () => {
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    expect((await service.getSchedule('o1', 'sc1')).currentOnCall).toBeNull();

    jest.setSystemTime(new Date('2026-01-14T00:00:00.000Z'));
    prisma.schedule.findFirst.mockResolvedValue({
      ...SCHEDULE,
      participants: [],
    });
    expect((await service.getSchedule('o1', 'sc1')).currentOnCall).toBeNull();
  });

  it('gives 404 for a schedule in another organization', async () => {
    prisma.schedule.findFirst.mockResolvedValue(null);

    await expect(service.getSchedule('o1', 'sc-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('createSchedule', () => {
    beforeEach(nameIsFree);

    it('stores the first handoff as the start, with participants in order', async () => {
      await service.createSchedule('u1', 'o1', {
        ...CREATE,
        participantIds: ['u2', 'u1'],
      });

      const data = (
        prisma.schedule.create.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;
      expect(data.startDate).toEqual(new Date('2026-01-05T04:30:00.000Z'));
      expect(data.handoffDay).toBe(1);
      expect(data.participants).toEqual({
        create: [
          { userId: 'u2', position: 0 },
          { userId: 'u1', position: 1 },
        ],
      });
    });

    it('needs a handoff day for weekly, and ignores it for daily', async () => {
      await expect(
        service.createSchedule('u1', 'o1', {
          ...CREATE,
          handoffDay: undefined,
        }),
      ).rejects.toThrow('handoffDay is required for a weekly rotation');

      await service.createSchedule('u1', 'o1', {
        ...CREATE,
        rotationType: 'DAILY',
      });
      const data = (
        prisma.schedule.create.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;
      expect(data.handoffDay).toBeNull();
    });

    it('rejects a team from another organization and a date that does not exist', async () => {
      await expect(
        service.createSchedule('u1', 'o1', {
          ...CREATE,
          startDate: '2026-02-31',
        }),
      ).rejects.toThrow('startDate is not a real date');

      prisma.team.findFirst.mockResolvedValue(null);
      await expect(service.createSchedule('u1', 'o1', CREATE)).rejects.toThrow(
        'Team not found in your organization',
      );
    });

    it('rejects a participant who is a viewer or not on the team', async () => {
      prisma.membership.findUnique.mockResolvedValue({
        role: 'VIEWER',
        user: { id: 'u9', name: 'Zara Khan' },
      });
      await expect(
        service.createSchedule('u1', 'o1', {
          ...CREATE,
          participantIds: ['u9'],
        }),
      ).rejects.toThrow("Zara Khan is a viewer and can't be on call");

      prisma.teamMember.findUnique.mockResolvedValue(null);
      await expect(
        service.createSchedule('u1', 'o1', {
          ...CREATE,
          participantIds: ['u9'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.schedule.create).not.toHaveBeenCalled();
    });
  });

  describe('updateSchedule', () => {
    it('keeps the same local start date when only the timezone changes', async () => {
      await service.updateSchedule('u1', 'o1', 'sc1', { timezone: 'UTC' });

      const data = (
        prisma.schedule.update.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;
      expect(data.startDate).toEqual(new Date('2026-01-05T10:00:00.000Z'));
    });

    it('drops the handoff day when switching to daily', async () => {
      await service.updateSchedule('u1', 'o1', 'sc1', {
        rotationType: 'DAILY',
      });

      const data = (
        prisma.schedule.update.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;
      expect(data.handoffDay).toBeNull();
    });
  });

  describe('deleteSchedule', () => {
    it('gives 409 listing the policies that page it', async () => {
      prisma.escalationPolicy.findMany.mockResolvedValue([
        { id: 'p1', name: 'Platform Critical' },
      ]);

      const error = await service
        .deleteSchedule('u1', 'o1', 'sc1')
        .catch((e: unknown) => e);

      expect((error as ConflictException).getResponse()).toEqual({
        message: 'Used by 1 escalation policy',
        policies: [{ id: 'p1', name: 'Platform Critical' }],
      });
      expect(prisma.schedule.delete).not.toHaveBeenCalled();
    });

    it('deletes a schedule nothing uses', async () => {
      await service.deleteSchedule('u1', 'o1', 'sc1');

      expect(prisma.schedule.delete).toHaveBeenCalledWith({
        where: { id: 'sc1' },
      });
    });
  });

  describe('participants', () => {
    it('adds a team member to the end of the rotation', async () => {
      await expect(
        service.addParticipant('u1', 'o1', 'sc1', 'u4'),
      ).resolves.toEqual({
        position: 3,
        userId: 'u4',
        name: 'Amit Sharma',
      });
    });

    it('gives 409 for someone already on the schedule', async () => {
      await expect(
        service.addParticipant('u1', 'o1', 'sc1', 'u2'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('closes the gap in positions after removing someone', async () => {
      prisma.scheduleParticipant.findMany.mockResolvedValue([
        { id: 'sp0', position: 0 },
        { id: 'sp2', position: 2 },
      ]);

      await service.removeParticipant('u1', 'o1', 'sc1', 'u2');

      expect(prisma.scheduleParticipant.deleteMany).toHaveBeenCalledWith({
        where: { scheduleId: 'sc1', userId: 'u2' },
      });
      expect(prisma.scheduleParticipant.update.mock.calls).toEqual([
        [{ where: { id: 'sp0' }, data: { position: 0 } }],
        [{ where: { id: 'sp2' }, data: { position: 1 } }],
      ]);
    });

    it('reorders when given exactly the current participants', async () => {
      await service.reorderParticipants('u1', 'o1', 'sc1', ['u3', 'u1', 'u2']);

      expect(prisma.scheduleParticipant.update.mock.calls[0]).toEqual([
        {
          where: { scheduleId_userId: { scheduleId: 'sc1', userId: 'u3' } },
          data: { position: 0 },
        },
      ]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it.each([[['u1', 'u2']], [['u1', 'u2', 'u9']], [['u1', 'u2', 'u3', 'u4']]])(
      'rejects an order that does not match the participants: %j',
      async (userIds) => {
        await expect(
          service.reorderParticipants('u1', 'o1', 'sc1', userIds),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );
  });

  it('answers who is on call at a given moment, with the shift times', async () => {
    const result = await service.getOnCall(
      'o1',
      'sc1',
      new Date('2026-01-20T00:00:00.000Z'),
    );

    expect(result).toEqual({
      scheduleId: 'sc1',
      at: new Date('2026-01-20T00:00:00.000Z'),
      onCall: { userId: 'u3', name: 'Sneha Kapoor', email: 'u3@acme.com' },
      shiftStart: new Date('2026-01-19T04:30:00.000Z'),
      shiftEnd: new Date('2026-01-26T04:30:00.000Z'),
    });

    const before = await service.getOnCall(
      'o1',
      'sc1',
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(before.onCall).toBeNull();
  });

  it('lists upcoming shifts, wrapping round the rotation', async () => {
    const result = await service.getUpcoming('o1', 'sc1', 4);

    expect(
      result.blocks.map((block) => [block.user?.name, block.current]),
    ).toEqual([
      ['Rahul Verma', true],
      ['Sneha Kapoor', false],
      ['Priyanshu Maurya', false],
      ['Rahul Verma', false],
      ['Sneha Kapoor', false],
    ]);
    expect(result.blocks[0].from).toEqual(new Date('2026-01-12T04:30:00.000Z'));
    expect(result.blocks[1].from).toEqual(result.blocks[0].to);
  });

  it('lists on-call for every schedule, for the dashboard', async () => {
    const result = await service.listOnCall('o1');

    expect(result.data).toEqual([
      {
        schedule: {
          id: 'sc1',
          name: 'Platform Weekly',
          timezone: 'Asia/Kolkata',
        },
        team: { id: 't1', name: 'Platform Team' },
        onCall: { userId: 'u2', name: 'Rahul Verma' },
        until: new Date('2026-01-19T04:30:00.000Z'),
      },
    ]);
  });
});
