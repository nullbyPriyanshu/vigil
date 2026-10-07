import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { CreateOnboardingServiceDto } from './dto/createOnboardingService.dto';

const DEFAULT_DELAY_MINUTES = 15;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  async createService(
    userId: string,
    organizationId: string,
    dto: CreateOnboardingServiceDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);

    const team = await this.prisma.team.findFirst({
      where: { id: dto.teamId, organizationId },
    });
    if (!team) {
      throw new BadRequestException('Team not found in your organization');
    }

    if (dto.scheduleId) {
      const schedule = await this.prisma.schedule.findFirst({
        where: { id: dto.scheduleId, organizationId },
      });
      if (!schedule) {
        throw new BadRequestException(
          'Schedule not found in your organization',
        );
      }
    }

    const policyName = `${dto.name} default`;

    const serviceExists = await this.prisma.service.findFirst({
      where: {
        organizationId,
        name: { equals: dto.name, mode: 'insensitive' },
      },
    });
    if (serviceExists) {
      throw new ConflictException(
        `A service named "${dto.name}" already exists`,
      );
    }

    const policyExists = await this.prisma.escalationPolicy.findFirst({
      where: {
        organizationId,
        name: { equals: policyName, mode: 'insensitive' },
      },
    });
    if (policyExists) {
      throw new ConflictException(
        `A policy named "${policyName}" already exists`,
      );
    }

    const escalationPolicy = await this.prisma.escalationPolicy.create({
      data: {
        name: policyName,
        organizationId,
        steps: {
          create: {
            position: 1,
            delayMinutes: DEFAULT_DELAY_MINUTES,
            targetType: dto.scheduleId ? 'SCHEDULE' : 'TEAM',
            scheduleId: dto.scheduleId ?? null,
            teamId: dto.scheduleId ? null : team.id,
          },
        },
      },
    });

    const service = await this.prisma.service.create({
      data: {
        name: dto.name,
        organizationId,
        teamId: team.id,
        escalationPolicyId: escalationPolicy.id,
      },
    });

    return {
      service: { id: service.id, name: service.name },
      escalationPolicy: {
        id: escalationPolicy.id,
        name: escalationPolicy.name,
      },
    };
  }
}
