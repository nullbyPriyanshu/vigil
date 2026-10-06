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

const RAHUL = '11111111-1111-4111-8111-111111111111';
const ZARA = '22222222-2222-4222-8222-222222222222';
const PLATFORM = '33333333-3333-4333-8333-333333333333';
const OUTSIDER = '44444444-4444-4444-8444-444444444444';

function createPrismaMock() {
  const models = {
    escalationPolicy: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    escalationStep: { deleteMany: jest.fn(), createMany: jest.fn() },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    // Rahul is a responder, Zara a viewer; nobody else is in the org.
    membership: {
      findMany: jest.fn().mockResolvedValue([
        { userId: RAHUL, role: 'RESPONDER', user: { name: 'Rahul Verma' } },
        { userId: ZARA, role: 'VIEWER', user: { name: 'Zara Khan' } },
      ]),
    },
    team: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: PLATFORM, name: 'Platform Team' }]),
    },
    user: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: RAHUL, name: 'Rahul Verma' }]),
    },
  };

  return {
    ...models,
    $transaction: jest.fn((run: (tx: typeof models) => unknown) => run(models)),
  };
}

const userStep = (position: number, targetId = RAHUL) => ({
  position,
  delayMinutes: 5,
  targetType: 'USER',
  targetId,
});
const teamStep = (position: number, targetId = PLATFORM) => ({
  position,
  delayMinutes: 10,
  targetType: 'TEAM',
  targetId,
});

const STORED = {
  id: 'p1',
  name: 'Platform Critical',
  repeatCount: 1,
  createdAt: new Date('2026-01-05'),
  steps: [
    { id: 's2', ...teamStep(2) },
    { id: 's1', ...userStep(1) },
  ],
};

describe('EscalationPoliciesService', () => {
  let service: EscalationPoliciesService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let members: { assertCanManageMembers: jest.Mock };

  const messageOf = async (promise: Promise<unknown>) => {
    const error = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).message;
  };

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

  describe('listPolicies', () => {
    it('returns step and service counts', async () => {
      prisma.escalationPolicy.findMany.mockResolvedValue([
        { ...STORED, _count: { steps: 4, services: 2 } },
      ]);

      await expect(service.listPolicies('o1')).resolves.toEqual({
        data: [
          {
            id: 'p1',
            name: 'Platform Critical',
            repeatCount: 1,
            stepCount: 4,
            serviceCount: 2,
            createdAt: STORED.createdAt,
          },
        ],
      });
    });
  });

  describe('getPolicy', () => {
    it('throws 404 for a policy in another organization', async () => {
      prisma.escalationPolicy.findFirst.mockResolvedValue(null);

      await expect(service.getPolicy('o1', 'p-other')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('orders the steps, names each target and lists the services', async () => {
      prisma.escalationPolicy.findFirst.mockResolvedValue(STORED);
      prisma.service.findMany.mockResolvedValue([
        { id: 'sv1', name: 'Checkout API' },
      ]);

      const policy = await service.getPolicy('o1', 'p1');

      expect(policy.steps).toEqual([
        {
          id: 's1',
          position: 1,
          delayMinutes: 5,
          targetType: 'USER',
          target: { id: RAHUL, name: 'Rahul Verma' },
        },
        {
          id: 's2',
          position: 2,
          delayMinutes: 10,
          targetType: 'TEAM',
          target: { id: PLATFORM, name: 'Platform Team' },
        },
      ]);
      expect(policy.services).toEqual([{ id: 'sv1', name: 'Checkout API' }]);
    });

    it('still shows a step whose team was deleted', async () => {
      prisma.escalationPolicy.findFirst.mockResolvedValue(STORED);
      prisma.team.findMany.mockResolvedValue([]);

      const policy = await service.getPolicy('o1', 'p1');

      expect(policy.steps[1].target).toEqual({
        id: PLATFORM,
        name: 'Deleted team',
      });
    });
  });

  describe('createPolicy', () => {
    const dto = (steps: unknown[]) => ({ name: 'Platform Critical', steps });

    beforeEach(() => prisma.escalationPolicy.create.mockResolvedValue(STORED));

    it('is refused for someone who cannot manage the organization', async () => {
      members.assertCanManageMembers.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.createPolicy('u9', 'o1', dto([userStep(1)])),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.escalationPolicy.create).not.toHaveBeenCalled();
    });

    it('saves the policy with its steps, defaulting repeatCount to 0', async () => {
      await service.createPolicy('u1', 'o1', dto([userStep(1), teamStep(2)]));

      const created = prisma.escalationPolicy.create.mock.calls[0] as [
        {
          data: {
            repeatCount: number;
            organizationId: string;
            steps: { create: unknown[] };
          };
        },
      ];
      expect(created[0].data.repeatCount).toBe(0);
      expect(created[0].data.organizationId).toBe('o1');
      expect(created[0].data.steps.create).toEqual([userStep(1), teamStep(2)]);
    });

    it('rejects a viewer as a target, by name and step', async () => {
      const message = await messageOf(
        service.createPolicy('u1', 'o1', dto([userStep(1), userStep(2, ZARA)])),
      );

      expect(message).toContain('Step 2: Zara Khan is a viewer');
      expect(prisma.escalationPolicy.create).not.toHaveBeenCalled();
    });

    it('rejects a person from outside the organization', async () => {
      const message = await messageOf(
        service.createPolicy('u1', 'o1', dto([userStep(1, OUTSIDER)])),
      );

      expect(message).toBe(
        'Step 1: that person is not a member of your organization',
      );
    });

    it('rejects a team from outside the organization', async () => {
      const message = await messageOf(
        service.createPolicy('u1', 'o1', dto([teamStep(1, OUTSIDER)])),
      );

      expect(message).toBe(
        'Step 1: that team does not exist in your organization',
      );
    });

    it('rejects a schedule target until schedules exist', async () => {
      const message = await messageOf(
        service.createPolicy(
          'u1',
          'o1',
          dto([{ ...userStep(1), targetType: 'SCHEDULE' }]),
        ),
      );

      expect(message).toContain("Step 1: schedules aren't available yet");
    });

    it('gives 409 when the name is already used', async () => {
      prisma.escalationPolicy.count.mockResolvedValue(1);

      await expect(
        service.createPolicy('u1', 'o1', dto([userStep(1)])),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updatePolicy', () => {
    beforeEach(() =>
      prisma.escalationPolicy.findFirst.mockResolvedValue(STORED),
    );

    it('changes only the name when no steps are sent', async () => {
      await service.updatePolicy('u1', 'o1', 'p1', { name: 'Renamed' });

      expect(prisma.escalationPolicy.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'Renamed', repeatCount: undefined },
      });
      expect(prisma.escalationStep.deleteMany).not.toHaveBeenCalled();
    });

    it('replaces every step, inside one transaction', async () => {
      await service.updatePolicy('u1', 'o1', 'p1', { steps: [teamStep(1)] });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.escalationStep.deleteMany).toHaveBeenCalledWith({
        where: { policyId: 'p1' },
      });
      expect(prisma.escalationStep.createMany).toHaveBeenCalledWith({
        data: [{ ...teamStep(1), policyId: 'p1' }],
      });
    });

    it('rejects bad steps before touching anything', async () => {
      await expect(
        service.updatePolicy('u1', 'o1', 'p1', { steps: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not check the name against itself', async () => {
      await service.updatePolicy('u1', 'o1', 'p1', {
        name: 'Platform Critical',
        repeatCount: 3,
      });

      expect(prisma.escalationPolicy.count).not.toHaveBeenCalled();
    });
  });

  describe('deletePolicy', () => {
    beforeEach(() =>
      prisma.escalationPolicy.findFirst.mockResolvedValue(STORED),
    );

    it('gives 409 and lists the services while the policy is in use', async () => {
      prisma.service.findMany.mockResolvedValue([
        { id: 'sv1', name: 'Checkout API' },
        { id: 'sv2', name: 'Payments API' },
      ]);

      const error = await service
        .deletePolicy('u1', 'o1', 'p1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        message: 'Policy is used by 2 services',
        services: [
          { id: 'sv1', name: 'Checkout API' },
          { id: 'sv2', name: 'Payments API' },
        ],
      });
      expect(prisma.escalationPolicy.delete).not.toHaveBeenCalled();
    });

    it('deletes an unused policy', async () => {
      await service.deletePolicy('u1', 'o1', 'p1');

      expect(prisma.escalationPolicy.delete).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
    });
  });
});
