import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugify } from 'src/auth/utils/slugify';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { SchedulesService } from 'src/schedules/schedules.service';
import { AddTeamMemberDto } from './dto/addTeamMember.dto';
import { CreateTeamDto } from './dto/createTeam.dto';
import { UpdateTeamDto } from './dto/updateTeam.dto';

function getInitials(name: string) {
  const words = name.trim().split(/\s+/);
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
    private readonly schedulesService: SchedulesService,
  ) {}

  async listTeams(organizationId: string) {
    const teams = await this.prisma.team.findMany({
      where: { organizationId },
      include: { members: { include: { user: true } }, services: true },
      orderBy: { name: 'asc' },
    });

    const data = teams.map((team) => {
      const users = team.members.map((member) => member.user);
      users.sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: team.id,
        name: team.name,
        slug: team.slug,
        memberCount: users.length,
        serviceCount: team.services.length,
        members: users.slice(0, 5).map((user) => ({
          userId: user.id,
          name: user.name,
          initials: getInitials(user.name),
        })),
      };
    });

    return { data };
  }

  async getTeam(organizationId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
      include: {
        members: true,
        services: { orderBy: { name: 'asc' } },
        schedules: { orderBy: { name: 'asc' } },
      },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const memberships = await this.prisma.membership.findMany({
      where: {
        organizationId,
        userId: { in: team.members.map((member) => member.userId) },
      },
      include: { user: true },
    });

    const members = memberships.map((membership) => ({
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
    }));
    members.sort((a, b) => a.name.localeCompare(b.name));

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      members,
      services: team.services.map((service) => ({
        id: service.id,
        name: service.name,
      })),
      schedules: team.schedules.map((schedule) => ({
        id: schedule.id,
        name: schedule.name,
      })),
    };
  }

  async createTeam(userId: string, organizationId: string, dto: CreateTeamDto) {
    await this.membersService.assertCanManageMembers(userId, organizationId);

    const slug = await this.getFreeSlug(organizationId, dto.name);
    const memberIds = dto.memberIds ?? [];

    const membersFound = await this.prisma.membership.count({
      where: { organizationId, userId: { in: memberIds } },
    });
    if (membersFound !== memberIds.length) {
      throw new BadRequestException(
        'Every team member must already be in your organization',
      );
    }

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        slug,
        organizationId,
        members: { create: memberIds.map((id) => ({ userId: id })) },
      },
    });

    return this.getTeam(organizationId, team.id);
  }

  async updateTeam(
    userId: string,
    organizationId: string,
    teamId: string,
    dto: UpdateTeamDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const team = await this.findTeamOrThrow(organizationId, teamId);

    const slug = await this.getFreeSlug(organizationId, dto.name, team.id);

    await this.prisma.team.update({
      where: { id: team.id },
      data: { name: dto.name, slug },
    });

    return this.getTeam(organizationId, team.id);
  }

  async deleteTeam(userId: string, organizationId: string, teamId: string) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const team = await this.getTeam(organizationId, teamId);

    if (team.services.length > 0) {
      const word = team.services.length === 1 ? 'service' : 'services';
      throw new ConflictException({
        message: `Team owns ${team.services.length} ${word}`,
        services: team.services,
      });
    }

    if (team.schedules.length > 0) {
      const word = team.schedules.length === 1 ? 'schedule' : 'schedules';
      throw new ConflictException({
        message: `Team owns ${team.schedules.length} ${word}`,
        schedules: team.schedules,
      });
    }

    await this.prisma.team.delete({ where: { id: team.id } });
  }

  async addTeamMember(
    userId: string,
    organizationId: string,
    teamId: string,
    dto: AddTeamMemberDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const team = await this.findTeamOrThrow(organizationId, teamId);

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId: dto.userId, organizationId },
      },
      include: { user: true },
    });
    if (!membership) {
      throw new BadRequestException(
        'This user is not a member of your organization',
      );
    }

    const alreadyOnTeam = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: dto.userId } },
    });
    if (!alreadyOnTeam) {
      await this.prisma.teamMember.create({
        data: { teamId: team.id, userId: dto.userId },
      });
    }

    return {
      teamId: team.id,
      userId: dto.userId,
      name: membership.user.name,
    };
  }

  async removeTeamMember(
    userId: string,
    organizationId: string,
    teamId: string,
    memberId: string,
    force: boolean,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const team = await this.findTeamOrThrow(organizationId, teamId);

    const schedules = await this.prisma.schedule.findMany({
      where: {
        teamId: team.id,
        participants: { some: { userId: memberId } },
      },
    });

    if (schedules.length > 0 && !force) {
      const word = schedules.length === 1 ? 'schedule' : 'schedules';
      throw new ConflictException({
        message: `User is on ${schedules.length} ${word}`,
        schedules: schedules.map((schedule) => ({
          id: schedule.id,
          name: schedule.name,
        })),
      });
    }

    for (const schedule of schedules) {
      await this.schedulesService.removeFromRotation(schedule.id, memberId);
    }

    await this.prisma.teamMember.deleteMany({
      where: { teamId: team.id, userId: memberId },
    });
  }

  private async findTeamOrThrow(organizationId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return team;
  }

  private async getFreeSlug(
    organizationId: string,
    name: string,
    ignoreTeamId?: string,
  ) {
    const slug = slugify(name);
    if (!slug) {
      throw new BadRequestException(
        'Team name must contain at least one letter or number',
      );
    }

    const existing = await this.prisma.team.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
    });
    if (existing && existing.id !== ignoreTeamId) {
      throw new ConflictException(
        `A team named "${existing.name}" already exists`,
      );
    }

    return slug;
  }
}
