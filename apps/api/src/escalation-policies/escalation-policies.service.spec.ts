import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma.service';
import { EscalationPoliciesService } from './escalation-policies.service';

const STORED = {
  id: 'p1',
  name: 'Platform Critical',
  repeatCount: 1,
  createdAt: new Date('2026-01-05'),
  steps: [
    {
      id: 'st1',
      position: 1,
      delayMinutes: 5,
      targetType: 'USER',
      user: { id: 'u2', name: 'Rahul Verma' },
      team: null,
      schedule: null,
    },
    {
      id: 'st2',
      position: 2,
      delayMinutes: 10,
      targetType: 'SCHEDULE',
      user: null,
      team: null,
      schedule: { id: 'sc1', name: 'Platform Weekly' },
    },
    {
      id: 'st3',
      position: 3,
      delayMinutes: 15,
      targetType: 'TEAM',
      user: null,
      team: null,
      schedule: null,
    },
  ],
  services: [{ id: 's1', name: 'Checkout API', teamId: 't1' }],
};

const STEP = {
  position: 1,
  delayMinutes: 5,
  targetType: 'USER' as const,
  targetId: 'u2',
};

function createPrismaMock() {
  return {
    escalationPolicy: {
      findMany: jest.fn().mockResolvedValue([STORED]),
      findFirst: jest.fn().mockResolvedValue(STORED),
      create: jest.fn().mockResolvedValue({ id: 'p1' }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    escalationStep: { deleteMany: jest.fn(), createMany: jest.fn() },
    membership: {
      findUnique: jest.fn().mockResolvedValue({ role: 'RESPONDER' }),
    },
    team: { findFirst: jest.fn().mockResolvedValue({ id: 't1' }) },
    schedule: { findFirst: jest.fn().mockResolvedValue({ id: 'sc1' }) },
    $transaction: jest.fn(),
  };
}

describe('EscalationPoliciesService', () => {
  let service: EscalationPoliciesService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let members: { assertCanManageMembers: jest.Mock };

  const nameIsFree = () =>
    prisma.escalationPolicy.findFirst.mockImplementation(
      ({ where }: { where: { name?: unknown } }) =>
        where.name ? null : STORED,
    );

  beforeEach(async () => {
    prisma = createPrismaMock();
    members = { assertCanManageMembers: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        EscalationPoliciesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembersService, useValue: members },
      ],
    }).compile();
    service = moduleRef.get(EscalationPoliciesService);
  });

  it('lists policies with step and service counts', async () => {
    const result = await service.listPolicies('o1');

    expect(result.data).toEqual([
      {
        id: 'p1',
        name: 'Platform Critical',
        repeatCount: 1,
        stepCount: 3,
        serviceCount: 1,
        createdAt: STORED.createdAt,
      },
    ]);
  });

  it('names each step target, and still shows a step whose target was deleted', async () => {
    const policy = await service.getPolicy('o1', 'p1');

    expect(policy.steps.map((step) => step.target)).toEqual([
      { id: 'u2', name: 'Rahul Verma' },
      { id: 'sc1', name: 'Platform Weekly' },
      { id: '', name: 'Removed' },
    ]);
    expect(policy.services).toEqual([{ id: 's1', name: 'Checkout API' }]);
  });

  it('gives 404 for a policy in another organization', async () => {
    prisma.escalationPolicy.findFirst.mockResolvedValue(null);

    await expect(service.getPolicy('o1', 'p-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.escalationPolicy.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-other', organizationId: 'o1' },
      }),
    );
  });

  describe('createPolicy', () => {
    it('is refused for someone who cannot manage the organization', async () => {
      members.assertCanManageMembers.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.createPolicy('u1', 'o1', { name: 'A', steps: [STEP] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('stores each target in the column for its type', async () => {
      nameIsFree();

      await service.createPolicy('u1', 'o1', {
        name: 'Platform Critical',
        steps: [
          STEP,
          { position: 2, delayMinutes: 10, targetType: 'TEAM', targetId: 't1' },
          {
            position: 3,
            delayMinutes: 15,
            targetType: 'SCHEDULE',
            targetId: 'sc1',
          },
        ],
      });

      const created = (
        prisma.escalationPolicy.create.mock.calls[0] as [
          { data: { repeatCount: number; steps: { create: unknown[] } } },
        ]
      )[0].data;
      expect(created.repeatCount).toBe(0);
      expect(created.steps.create).toEqual([
        {
          position: 1,
          delayMinutes: 5,
          targetType: 'USER',
          userId: 'u2',
          teamId: null,
          scheduleId: null,
        },
        {
          position: 2,
          delayMinutes: 10,
          targetType: 'TEAM',
          userId: null,
          teamId: 't1',
          scheduleId: null,
        },
        {
          position: 3,
          delayMinutes: 15,
          targetType: 'SCHEDULE',
          userId: null,
          teamId: null,
          scheduleId: 'sc1',
        },
      ]);
    });

    it.each([
      [[{ ...STEP, position: 2 }]],
      [[STEP, { ...STEP }]],
      [[STEP, { ...STEP, position: 3 }]],
    ])('rejects positions that are not 1, 2, 3...', async (steps) => {
      await expect(
        service.createPolicy('u1', 'o1', { name: 'A', steps }),
      ).rejects.toThrow(/Step positions/);
    });

    it('rejects a person outside the organization, and a viewer', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(
        service.createPolicy('u1', 'o1', { name: 'A', steps: [STEP] }),
      ).rejects.toThrow(
        'Step 1: that person is not a member of your organization',
      );

      prisma.membership.findUnique.mockResolvedValue({ role: 'VIEWER' });
      await expect(
        service.createPolicy('u1', 'o1', { name: 'A', steps: [STEP] }),
      ).rejects.toThrow(/Step 1: viewers can't respond/);
    });

    it('rejects a team or schedule from outside the organization', async () => {
      prisma.team.findFirst.mockResolvedValue(null);
      await expect(
        service.createPolicy('u1', 'o1', {
          name: 'A',
          steps: [{ ...STEP, targetType: 'TEAM', targetId: 't9' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.team.findFirst).toHaveBeenCalledWith({
        where: { id: 't9', organizationId: 'o1' },
      });

      prisma.schedule.findFirst.mockResolvedValue(null);
      await expect(
        service.createPolicy('u1', 'o1', {
          name: 'A',
          steps: [{ ...STEP, targetType: 'SCHEDULE', targetId: 'sc9' }],
        }),
      ).rejects.toThrow(
        'Step 1: that schedule does not exist in your organization',
      );
    });

    it('gives 409 when the name is already used', async () => {
      await expect(
        service.createPolicy('u1', 'o1', {
          name: 'platform critical',
          steps: [STEP],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.escalationPolicy.create).not.toHaveBeenCalled();
    });
  });

  describe('updatePolicy', () => {
    it('changes only the name when no steps are sent', async () => {
      nameIsFree();

      await service.updatePolicy('u1', 'o1', 'p1', { name: 'New name' });

      expect(prisma.escalationPolicy.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'New name', repeatCount: undefined },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('replaces every step in one transaction', async () => {
      await service.updatePolicy('u1', 'o1', 'p1', { steps: [STEP] });

      expect(prisma.escalationStep.deleteMany).toHaveBeenCalledWith({
        where: { policyId: 'p1' },
      });
      expect(prisma.escalationStep.createMany).toHaveBeenCalledWith({
        data: [
          {
            position: 1,
            delayMinutes: 5,
            targetType: 'USER',
            userId: 'u2',
            teamId: null,
            scheduleId: null,
            policyId: 'p1',
          },
        ],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects bad steps before changing anything', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePolicy('u1', 'o1', 'p1', {
          name: 'Platform Critical',
          steps: [STEP],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.escalationPolicy.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('deletePolicy', () => {
    it('gives 409 and lists the services while the policy is in use', async () => {
      const error = await service
        .deletePolicy('u1', 'o1', 'p1')
        .catch((e: unknown) => e);

      expect((error as ConflictException).getResponse()).toEqual({
        message: 'Policy is used by 1 service',
        services: [{ id: 's1', name: 'Checkout API' }],
      });
      expect(prisma.escalationPolicy.delete).not.toHaveBeenCalled();
    });

    it('deletes an unused policy', async () => {
      prisma.escalationPolicy.findFirst.mockResolvedValue({
        ...STORED,
        services: [],
      });

      await service.deletePolicy('u1', 'o1', 'p1');

      expect(prisma.escalationPolicy.delete).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
    });
  });
});
