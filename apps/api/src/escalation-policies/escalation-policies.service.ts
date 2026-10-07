import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import {
  CreateEscalationPolicyDto,
  StepDto,
} from './dto/createEscalationPolicy.dto';
import { UpdateEscalationPolicyDto } from './dto/updateEscalationPolicy.dto';

@Injectable()
export class EscalationPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  async listPolicies(organizationId: string) {
    const policies = await this.prisma.escalationPolicy.findMany({
      where: { organizationId },
      include: { steps: true, services: true },
      orderBy: { name: 'asc' },
    });

    const data = policies.map((policy) => ({
      id: policy.id,
      name: policy.name,
      repeatCount: policy.repeatCount,
      stepCount: policy.steps.length,
      serviceCount: policy.services.length,
      createdAt: policy.createdAt,
    }));

    return { data };
  }

  async getPolicy(organizationId: string, policyId: string) {
    const policy = await this.prisma.escalationPolicy.findFirst({
      where: { id: policyId, organizationId },
      include: {
        steps: {
          include: { user: true, team: true, schedule: true },
          orderBy: { position: 'asc' },
        },
        services: { orderBy: { name: 'asc' } },
      },
    });
    if (!policy) {
      throw new NotFoundException('Escalation policy not found');
    }

    const steps = policy.steps.map((step) => {
      let target = { id: '', name: 'Removed' };
      if (step.user) target = { id: step.user.id, name: step.user.name };
      if (step.team) target = { id: step.team.id, name: step.team.name };
      if (step.schedule) {
        target = { id: step.schedule.id, name: step.schedule.name };
      }

      return {
        id: step.id,
        position: step.position,
        delayMinutes: step.delayMinutes,
        targetType: step.targetType,
        target,
      };
    });

    return {
      id: policy.id,
      name: policy.name,
      repeatCount: policy.repeatCount,
      steps,
      services: policy.services.map((service) => ({
        id: service.id,
        name: service.name,
      })),
      createdAt: policy.createdAt,
    };
  }

  async createPolicy(
    userId: string,
    organizationId: string,
    dto: CreateEscalationPolicyDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    await this.checkSteps(organizationId, dto.steps);
    await this.checkNameIsFree(organizationId, dto.name);

    const policy = await this.prisma.escalationPolicy.create({
      data: {
        name: dto.name,
        repeatCount: dto.repeatCount ?? 0,
        organizationId,
        steps: { create: dto.steps.map((step) => this.toStepData(step)) },
      },
    });

    return this.getPolicy(organizationId, policy.id);
  }

  async updatePolicy(
    userId: string,
    organizationId: string,
    policyId: string,
    dto: UpdateEscalationPolicyDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const policy = await this.getPolicy(organizationId, policyId);

    if (dto.name && dto.name !== policy.name) {
      await this.checkNameIsFree(organizationId, dto.name, policy.id);
    }
    if (dto.steps) {
      await this.checkSteps(organizationId, dto.steps);
    }

    await this.prisma.escalationPolicy.update({
      where: { id: policy.id },
      data: { name: dto.name, repeatCount: dto.repeatCount },
    });

    if (dto.steps) {
      const newSteps = dto.steps.map((step) => ({
        ...this.toStepData(step),
        policyId: policy.id,
      }));

      await this.prisma.$transaction([
        this.prisma.escalationStep.deleteMany({
          where: { policyId: policy.id },
        }),
        this.prisma.escalationStep.createMany({ data: newSteps }),
      ]);
    }

    return this.getPolicy(organizationId, policy.id);
  }

  async deletePolicy(userId: string, organizationId: string, policyId: string) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const policy = await this.getPolicy(organizationId, policyId);

    if (policy.services.length > 0) {
      const word = policy.services.length === 1 ? 'service' : 'services';
      throw new ConflictException({
        message: `Policy is used by ${policy.services.length} ${word}`,
        services: policy.services,
      });
    }

    await this.prisma.escalationPolicy.delete({ where: { id: policy.id } });
  }

  private toStepData(step: StepDto) {
    return {
      position: step.position,
      delayMinutes: step.delayMinutes,
      targetType: step.targetType,
      userId: step.targetType === 'USER' ? step.targetId : null,
      teamId: step.targetType === 'TEAM' ? step.targetId : null,
      scheduleId: step.targetType === 'SCHEDULE' ? step.targetId : null,
    };
  }

  private async checkSteps(organizationId: string, steps: StepDto[]) {
    const positions = steps.map((step) => step.position).sort((a, b) => a - b);
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] !== i + 1) {
        throw new BadRequestException(
          'Step positions must be 1, 2, 3 and so on, with no gaps or repeats',
        );
      }
    }

    for (const step of steps) {
      const label = `Step ${step.position}`;

      if (step.targetType === 'USER') {
        const membership = await this.prisma.membership.findUnique({
          where: {
            userId_organizationId: { userId: step.targetId, organizationId },
          },
        });
        if (!membership) {
          throw new BadRequestException(
            `${label}: that person is not a member of your organization`,
          );
        }
        if (membership.role === 'VIEWER') {
          throw new BadRequestException(
            `${label}: viewers can't respond to incidents. Pick an owner, admin or responder`,
          );
        }
      }

      if (step.targetType === 'TEAM') {
        const team = await this.prisma.team.findFirst({
          where: { id: step.targetId, organizationId },
        });
        if (!team) {
          throw new BadRequestException(
            `${label}: that team does not exist in your organization`,
          );
        }
      }

      if (step.targetType === 'SCHEDULE') {
        const schedule = await this.prisma.schedule.findFirst({
          where: { id: step.targetId, organizationId },
        });
        if (!schedule) {
          throw new BadRequestException(
            `${label}: that schedule does not exist in your organization`,
          );
        }
      }
    }
  }

  private async checkNameIsFree(
    organizationId: string,
    name: string,
    ignorePolicyId?: string,
  ) {
    const existing = await this.prisma.escalationPolicy.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: 'insensitive' },
        id: { not: ignorePolicyId },
      },
    });
    if (existing) {
      throw new ConflictException(`A policy named "${name}" already exists`);
    }
  }
}
