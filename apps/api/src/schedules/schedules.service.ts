import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { CreateScheduleDto } from './dto/createSchedule.dto';
import { UpdateScheduleDto } from './dto/updateSchedule.dto';
import { getFirstHandoff, getShift } from './onCall';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  async listSchedules(organizationId: string) {
    const schedules = await this.prisma.schedule.findMany({
      where: { organizationId },
      include: {
        team: true,
        participants: { include: { user: true }, orderBy: { position: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    const data = schedules.map((schedule) => ({
      id: schedule.id,
      name: schedule.name,
      team: { id: schedule.team.id, name: schedule.team.name },
      timezone: schedule.timezone,
      rotationType: schedule.rotationType,
      handoffDay: schedule.handoffDay,
      handoffTime: schedule.handoffTime,
      participantCount: schedule.participants.length,
      currentOnCall: this.getCurrentOnCall(schedule),
    }));

    return { data };
  }

  async getSchedule(organizationId: string, scheduleId: string) {
    const schedule = await this.findScheduleOrThrow(organizationId, scheduleId);

    return {
      id: schedule.id,
      name: schedule.name,
      team: { id: schedule.team.id, name: schedule.team.name },
      timezone: schedule.timezone,
      rotationType: schedule.rotationType,
      handoffDay: schedule.handoffDay,
      handoffTime: schedule.handoffTime,
      startDate: schedule.startDate,
      participants: schedule.participants.map((participant) => ({
        position: participant.position,
        userId: participant.userId,
        name: participant.user.name,
      })),
      currentOnCall: this.getCurrentOnCall(schedule),
    };
  }

  async createSchedule(
    userId: string,
    organizationId: string,
    dto: CreateScheduleDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);

    const team = await this.prisma.team.findFirst({
      where: { id: dto.teamId, organizationId },
    });
    if (!team) {
      throw new BadRequestException('Team not found in your organization');
    }

    if (dto.rotationType === 'WEEKLY' && dto.handoffDay === undefined) {
      throw new BadRequestException(
        'handoffDay is required for a weekly rotation',
      );
    }
    this.checkStartDate(dto.startDate);
    await this.checkNameIsFree(organizationId, dto.name);

    const participantIds = dto.participantIds ?? [];
    for (const participantId of participantIds) {
      await this.checkCanBeOnCall(organizationId, team.id, participantId);
    }

    const handoffDay = dto.rotationType === 'WEEKLY' ? dto.handoffDay! : null;

    const schedule = await this.prisma.schedule.create({
      data: {
        name: dto.name,
        timezone: dto.timezone,
        rotationType: dto.rotationType,
        handoffDay,
        handoffTime: dto.handoffTime,
        startDate: getFirstHandoff(
          dto.startDate,
          dto.handoffTime,
          dto.timezone,
          dto.rotationType,
          handoffDay,
        ),
        organizationId,
        teamId: team.id,
        participants: {
          create: participantIds.map((participantId, index) => ({
            userId: participantId,
            position: index,
          })),
        },
      },
    });

    return this.getSchedule(organizationId, schedule.id);
  }

  async updateSchedule(
    userId: string,
    organizationId: string,
    scheduleId: string,
    dto: UpdateScheduleDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const schedule = await this.findScheduleOrThrow(organizationId, scheduleId);

    if (dto.name && dto.name !== schedule.name) {
      await this.checkNameIsFree(organizationId, dto.name, schedule.id);
    }
    if (dto.startDate) {
      this.checkStartDate(dto.startDate);
    }

    const timezone = dto.timezone ?? schedule.timezone;
    const rotationType = dto.rotationType ?? schedule.rotationType;
    const handoffTime = dto.handoffTime ?? schedule.handoffTime;

    let handoffDay: number | null = null;
    if (rotationType === 'WEEKLY') {
      handoffDay = dto.handoffDay ?? schedule.handoffDay;
      if (handoffDay === null) {
        throw new BadRequestException(
          'handoffDay is required for a weekly rotation',
        );
      }
    }

    const oldStartDate = DateTime.fromJSDate(schedule.startDate, {
      zone: schedule.timezone,
    }).toISODate()!;
    const startDate = dto.startDate ?? oldStartDate;

    await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        name: dto.name,
        timezone,
        rotationType,
        handoffDay,
        handoffTime,
        startDate: getFirstHandoff(
          startDate,
          handoffTime,
          timezone,
          rotationType,
          handoffDay,
        ),
      },
    });

    return this.getSchedule(organizationId, schedule.id);
  }

  async deleteSchedule(
    userId: string,
    organizationId: string,
    scheduleId: string,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const schedule = await this.findScheduleOrThrow(organizationId, scheduleId);

    const policies = await this.prisma.escalationPolicy.findMany({
      where: { steps: { some: { scheduleId: schedule.id } } },
      orderBy: { name: 'asc' },
    });

    if (policies.length > 0) {
      const word = policies.length === 1 ? 'policy' : 'policies';
      throw new ConflictException({
        message: `Used by ${policies.length} escalation ${word}`,
        policies: policies.map((policy) => ({
          id: policy.id,
          name: policy.name,
        })),
      });
    }

    await this.prisma.schedule.delete({ where: { id: schedule.id } });
  }

  async addParticipant(
    userId: string,
    organizationId: string,
    scheduleId: string,
    participantId: string,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const schedule = await this.findScheduleOrThrow(organizationId, scheduleId);

    const alreadyThere = schedule.participants.some(
      (participant) => participant.userId === participantId,
    );
    if (alreadyThere) {
      throw new ConflictException('This person is already on the schedule');
    }

    const user = await this.checkCanBeOnCall(
      organizationId,
      schedule.teamId,
      participantId,
    );

    const participant = await this.prisma.scheduleParticipant.create({
      data: {
        scheduleId: schedule.id,
        userId: participantId,
        position: schedule.participants.length,
      },
    });

    return {
      position: participant.position,
      userId: participant.userId,
      name: user.name,
    };
  }

  async removeParticipant(
    userId: string,
    organizationId: string,
    scheduleId: string,
    participantId: string,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const schedule = await this.findScheduleOrThrow(organizationId, scheduleId);

    await this.removeFromRotation(schedule.id, participantId);
  }

  async reorderParticipants(
    userId: string,
    organizationId: string,
    scheduleId: string,
    userIds: string[],
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const schedule = await this.findScheduleOrThrow(organizationId, scheduleId);

    const currentIds = schedule.participants.map(
      (participant) => participant.userId,
    );
    const sameList =
      userIds.length === currentIds.length &&
      userIds.every((id) => currentIds.includes(id));
    if (!sameList) {
      throw new BadRequestException(
        'userIds must contain exactly the current participants',
      );
    }

    await this.prisma.$transaction(
      userIds.map((id, index) =>
        this.prisma.scheduleParticipant.update({
          where: { scheduleId_userId: { scheduleId: schedule.id, userId: id } },
          data: { position: index },
        }),
      ),
    );

    const updated = await this.getSchedule(organizationId, schedule.id);
    return { participants: updated.participants };
  }

  async getOnCall(organizationId: string, scheduleId: string, at: Date) {
    const schedule = await this.findScheduleOrThrow(organizationId, scheduleId);
    const shift = getShift(schedule, at);

    let onCall: { userId: string; name: string; email: string } | null = null;
    if (shift && schedule.participants.length > 0) {
      const participant =
        schedule.participants[shift.number % schedule.participants.length];
      onCall = {
        userId: participant.userId,
        name: participant.user.name,
        email: participant.user.email,
      };
    }

    return {
      scheduleId: schedule.id,
      at,
      onCall,
      shiftStart: shift ? shift.start : null,
      shiftEnd: shift ? shift.end : null,
    };
  }

  async getUpcoming(organizationId: string, scheduleId: string, weeks: number) {
    const schedule = await this.findScheduleOrThrow(organizationId, scheduleId);

    const now = new Date();
    const lastDay = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    const blocks: {
      from: Date;
      to: Date;
      user: { id: string; name: string } | null;
      current: boolean;
    }[] = [];

    let shift =
      getShift(schedule, now) ?? getShift(schedule, schedule.startDate);

    while (shift && shift.start < lastDay && blocks.length < 400) {
      let user: { id: string; name: string } | null = null;
      if (schedule.participants.length > 0) {
        const participant =
          schedule.participants[shift.number % schedule.participants.length];
        user = { id: participant.userId, name: participant.user.name };
      }

      blocks.push({
        from: shift.start,
        to: shift.end,
        user,
        current: shift.start <= now && now < shift.end,
      });

      shift = getShift(schedule, shift.end);
    }

    return { scheduleId: schedule.id, timezone: schedule.timezone, blocks };
  }

  async listOnCall(organizationId: string) {
    const schedules = await this.prisma.schedule.findMany({
      where: { organizationId },
      include: {
        team: true,
        participants: { include: { user: true }, orderBy: { position: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    const data = schedules.map((schedule) => {
      const current = this.getCurrentOnCall(schedule);

      return {
        schedule: {
          id: schedule.id,
          name: schedule.name,
          timezone: schedule.timezone,
        },
        team: { id: schedule.team.id, name: schedule.team.name },
        onCall: current ? { userId: current.userId, name: current.name } : null,
        until: current ? current.until : null,
      };
    });

    return { data };
  }

  async findOnCallUser(scheduleId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        participants: { include: { user: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!schedule || schedule.participants.length === 0) {
      return null;
    }

    const shift = getShift(schedule, new Date());
    if (!shift) {
      return null;
    }

    return schedule.participants[shift.number % schedule.participants.length]
      .user;
  }

  async removeFromRotation(scheduleId: string, userId: string) {
    await this.prisma.scheduleParticipant.deleteMany({
      where: { scheduleId, userId },
    });

    const remaining = await this.prisma.scheduleParticipant.findMany({
      where: { scheduleId },
      orderBy: { position: 'asc' },
    });

    await this.prisma.$transaction(
      remaining.map((participant, index) =>
        this.prisma.scheduleParticipant.update({
          where: { id: participant.id },
          data: { position: index },
        }),
      ),
    );
  }

  private getCurrentOnCall(schedule: {
    timezone: string;
    rotationType: 'DAILY' | 'WEEKLY';
    startDate: Date;
    participants: { userId: string; user: { name: string } }[];
  }) {
    const shift = getShift(schedule, new Date());
    if (!shift || schedule.participants.length === 0) {
      return null;
    }

    const participant =
      schedule.participants[shift.number % schedule.participants.length];

    return {
      userId: participant.userId,
      name: participant.user.name,
      until: shift.end,
    };
  }

  private async findScheduleOrThrow(
    organizationId: string,
    scheduleId: string,
  ) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, organizationId },
      include: {
        team: true,
        participants: { include: { user: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }
    return schedule;
  }

  private async checkCanBeOnCall(
    organizationId: string,
    teamId: string,
    userId: string,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: true },
    });
    const teamMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership || !teamMember) {
      throw new BadRequestException(
        "Participants must be members of the schedule's team",
      );
    }
    if (membership.role === 'VIEWER') {
      throw new BadRequestException(
        `${membership.user.name} is a viewer and can't be on call`,
      );
    }

    return membership.user;
  }

  private checkStartDate(startDate: string) {
    if (!DateTime.fromISO(startDate).isValid) {
      throw new BadRequestException('startDate is not a real date');
    }
  }

  private async checkNameIsFree(
    organizationId: string,
    name: string,
    ignoreScheduleId?: string,
  ) {
    const existing = await this.prisma.schedule.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: 'insensitive' },
        id: { not: ignoreScheduleId },
      },
    });
    if (existing) {
      throw new ConflictException(`A schedule named "${name}" already exists`);
    }
  }
}
