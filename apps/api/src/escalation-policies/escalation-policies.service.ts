import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EscalationTargetType } from 'src/generated/prisma/enums';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { CreateEscalationPolicyDto } from './dto/createEscalationPolicy.dto';
import { UpdateEscalationPolicyDto } from './dto/updateEscalationPolicy.dto';
import { parseSteps, type StepInput } from './steps.validation';

type StoredStep = {
  id: string;
  position: number;
  delayMinutes: number;
  targetType: EscalationTargetType;
  targetId: string;
};

type StoredPolicy = {
  id: string;
  name: string;
  repeatCount: number;
  createdAt: Date;
  steps: StoredStep[];
};

@Injectable()
export class EscalationPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  // ---------- Reading (any role) ----------

  async listPolicies(organizationId: string) {
    const policies = await this.prisma.escalationPolicy.findMany({
      where: { organizationId },
      include: { _count: { select: { steps: true, services: true } } },
      orderBy: { name: 'asc' },
    });

    return {
      data: policies.map((policy) => ({
        id: policy.id,
        name: policy.name,
        repeatCount: policy.repeatCount,
        stepCount: policy._count.steps,
        serviceCount: policy._count.services,
        createdAt: policy.createdAt,
      })),
    };
  }

  async getPolicy(organizationId: string, policyId: string) {
    const policy = await this.findPolicyOrThrow(organizationId, policyId);

    const services = await this.prisma.service.findMany({
      where: { escalationPolicyId: policy.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return { ...(await this.toPolicy(policy)), services };
  }

  // ---------- Changing (owners and admins) ----------

  async createPolicy(
    currentUserId: string,
    organizationId: string,
    dto: CreateEscalationPolicyDto,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );

    const steps = parseSteps(dto.steps);
    await this.assertTargetsAreValid(organizationId, steps);
    await this.assertNameIsFree(organizationId, dto.name);

    const policy = await this.prisma.escalationPolicy.create({
      data: {
        name: dto.name,
        repeatCount: dto.repeatCount ?? 0,
        organizationId,
        steps: { create: steps },
      },
      include: { steps: true },
    });

    return this.toPolicy(policy);
  }

  async updatePolicy(
    currentUserId: string,
    organizationId: string,
    policyId: string,
    dto: UpdateEscalationPolicyDto,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
    const policy = await this.findPolicyOrThrow(organizationId, policyId);

    if (dto.name !== undefined && dto.name !== policy.name) {
      await this.assertNameIsFree(organizationId, dto.name, policy.id);
    }

    // `steps` is optional here. When it's sent, it must be a complete,
    // valid list, because it replaces every existing step.
    const steps = dto.steps === undefined ? undefined : parseSteps(dto.steps);
    if (steps) {
      await this.assertTargetsAreValid(organizationId, steps);
    }

    // One transaction, so the policy is never left half-changed (for
    // example with its old steps deleted but the new ones not saved).
    await this.prisma.$transaction(async (tx) => {
      await tx.escalationPolicy.update({
        where: { id: policy.id },
        data: { name: dto.name, repeatCount: dto.repeatCount },
      });

      if (steps) {
        await tx.escalationStep.deleteMany({ where: { policyId: policy.id } });
        await tx.escalationStep.createMany({
          data: steps.map((step) => ({ ...step, policyId: policy.id })),
        });
      }
    });

    return this.toPolicy(
      await this.findPolicyOrThrow(organizationId, policy.id),
    );
  }

  async deletePolicy(
    currentUserId: string,
    organizationId: string,
    policyId: string,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
    const policy = await this.findPolicyOrThrow(organizationId, policyId);

    // A service must always have a policy, so one that is still in use
    // can't be deleted. The response lists the services to move first.
    const services = await this.prisma.service.findMany({
      where: { escalationPolicyId: policy.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    if (services.length > 0) {
      throw new ConflictException({
        message: `Policy is used by ${services.length} ${services.length === 1 ? 'service' : 'services'}`,
        services,
      });
    }

    // The steps go with it (onDelete: Cascade in the schema).
    await this.prisma.escalationPolicy.delete({ where: { id: policy.id } });
  }

  // ---------- Helpers ----------

  // Looking the policy up together with organizationId is what stops one
  // organization from reading or changing another's policies.
  private async findPolicyOrThrow(organizationId: string, policyId: string) {
    const policy = await this.prisma.escalationPolicy.findFirst({
      where: { id: policyId, organizationId },
      include: { steps: true },
    });

    if (!policy) {
      throw new NotFoundException('Escalation policy not found');
    }

    return policy;
  }

  // Names are compared ignoring case, so "Checkout API" and "checkout api"
  // can't both exist. `ignoreId` is the policy being renamed, so it doesn't
  // clash with itself.
  private async assertNameIsFree(
    organizationId: string,
    name: string,
    ignoreId?: string,
  ) {
    const taken = await this.prisma.escalationPolicy.count({
      where: {
        organizationId,
        name: { equals: name, mode: 'insensitive' },
        id: { not: ignoreId },
      },
    });
    if (taken > 0) {
      throw new ConflictException(`A policy named "${name}" already exists`);
    }
  }

  // Makes sure every step points at someone real in this organization:
  //  - USER: a member who isn't a viewer (viewers can't respond)
  //  - TEAM: one of the organization's teams
  //  - SCHEDULE: not possible yet, schedules haven't been built
  private async assertTargetsAreValid(
    organizationId: string,
    steps: StepInput[],
  ) {
    const userIds = steps
      .filter((step) => step.targetType === 'USER')
      .map((step) => step.targetId);
    const teamIds = steps
      .filter((step) => step.targetType === 'TEAM')
      .map((step) => step.targetId);

    const memberships = await this.prisma.membership.findMany({
      where: { organizationId, userId: { in: userIds } },
      include: { user: true },
    });
    const teams = await this.prisma.team.findMany({
      where: { organizationId, id: { in: teamIds } },
    });

    for (const step of steps) {
      const fail = (problem: string): never => {
        throw new BadRequestException(`Step ${step.position}: ${problem}`);
      };

      if (step.targetType === 'SCHEDULE') {
        // TODO (schedules): look the schedule up in this organization.
        fail("schedules aren't available yet, pick a person or a team");
      }

      if (step.targetType === 'USER') {
        const membership = memberships.find((m) => m.userId === step.targetId);
        if (!membership) {
          fail('that person is not a member of your organization');
        } else if (membership.role === 'VIEWER') {
          fail(
            `${membership.user.name} is a viewer and can't respond to incidents. Pick an owner, admin or responder`,
          );
        }
      }

      if (
        step.targetType === 'TEAM' &&
        !teams.some((team) => team.id === step.targetId)
      ) {
        fail('that team does not exist in your organization');
      }
    }
  }

  // Builds the API shape, swapping each step's bare targetId for
  // `{ id, name }` so the screen can show who it is.
  private async toPolicy(policy: StoredPolicy) {
    const steps = [...policy.steps].sort((a, b) => a.position - b.position);

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: steps
            .filter((step) => step.targetType === 'USER')
            .map((step) => step.targetId),
        },
      },
      select: { id: true, name: true },
    });
    const teams = await this.prisma.team.findMany({
      where: {
        id: {
          in: steps
            .filter((step) => step.targetType === 'TEAM')
            .map((step) => step.targetId),
        },
      },
      select: { id: true, name: true },
    });

    // A step can outlive its target (the team was deleted, say). It still
    // shows up, labelled, so someone notices and fixes the policy.
    const nameOf = (step: StoredStep) => {
      if (step.targetType === 'USER') {
        return (
          users.find((user) => user.id === step.targetId)?.name ??
          'Removed user'
        );
      }
      if (step.targetType === 'TEAM') {
        return (
          teams.find((team) => team.id === step.targetId)?.name ??
          'Deleted team'
        );
      }
      return 'Schedule';
    };

    return {
      id: policy.id,
      name: policy.name,
      repeatCount: policy.repeatCount,
      steps: steps.map((step) => ({
        id: step.id,
        position: step.position,
        delayMinutes: step.delayMinutes,
        targetType: step.targetType,
        target: { id: step.targetId, name: nameOf(step) },
      })),
      createdAt: policy.createdAt,
    };
  }
}
