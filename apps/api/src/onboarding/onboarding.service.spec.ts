import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma.service';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: {
    team: { findFirst: jest.Mock };
    schedule: { findFirst: jest.Mock };
    service: { findFirst: jest.Mock; create: jest.Mock };
    escalationPolicy: { findFirst: jest.Mock; create: jest.Mock };
  };

  const policyStep = () =>
    (
      prisma.escalationPolicy.create.mock.calls[0] as [
        { data: { name: string; steps: { create: unknown } } },
      ]
    )[0].data;

  beforeEach(async () => {
    prisma = {
      team: { findFirst: jest.fn().mockResolvedValue({ id: 't1' }) },
      schedule: { findFirst: jest.fn().mockResolvedValue({ id: 'sc1' }) },
      service: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 's1', name: 'Checkout API' }),
      },
      escalationPolicy: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'p1', name: 'Checkout API default' }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: MembersService,
          useValue: { assertCanManageMembers: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(OnboardingService);
  });

  it('creates a default policy that notifies the whole team, then the service', async () => {
    const result = await service.createService('u1', 'o1', {
      name: 'Checkout API',
      teamId: 't1',
    });

    expect(policyStep().name).toBe('Checkout API default');
    expect(policyStep().steps.create).toEqual({
      position: 1,
      delayMinutes: 15,
      targetType: 'TEAM',
      scheduleId: null,
      teamId: 't1',
    });
    expect(prisma.service.create).toHaveBeenCalledWith({
      data: {
        name: 'Checkout API',
        organizationId: 'o1',
        teamId: 't1',
        escalationPolicyId: 'p1',
      },
    });
    expect(result).toEqual({
      service: { id: 's1', name: 'Checkout API' },
      escalationPolicy: { id: 'p1', name: 'Checkout API default' },
    });
  });

  it('points the policy at the schedule when one is given', async () => {
    await service.createService('u1', 'o1', {
      name: 'Checkout API',
      teamId: 't1',
      scheduleId: 'sc1',
    });

    expect(policyStep().steps.create).toMatchObject({
      targetType: 'SCHEDULE',
      scheduleId: 'sc1',
      teamId: null,
    });
  });

  it('rejects a team or schedule from another organization', async () => {
    prisma.schedule.findFirst.mockResolvedValue(null);
    await expect(
      service.createService('u1', 'o1', {
        name: 'A service',
        teamId: 't1',
        scheduleId: 'sc9',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.team.findFirst.mockResolvedValue(null);
    await expect(
      service.createService('u1', 'o1', { name: 'A service', teamId: 't9' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.escalationPolicy.create).not.toHaveBeenCalled();
  });

  it('gives 409 when the service or the default policy name is taken, creating nothing', async () => {
    prisma.service.findFirst.mockResolvedValue({ id: 's0' });
    await expect(
      service.createService('u1', 'o1', { name: 'Checkout API', teamId: 't1' }),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.service.findFirst.mockResolvedValue(null);
    prisma.escalationPolicy.findFirst.mockResolvedValue({ id: 'p0' });
    await expect(
      service.createService('u1', 'o1', { name: 'Checkout API', teamId: 't1' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.escalationPolicy.create).not.toHaveBeenCalled();
    expect(prisma.service.create).not.toHaveBeenCalled();
  });
});
