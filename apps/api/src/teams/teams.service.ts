import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugify } from 'src/auth/utils/slugify';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { AddTeamMemberDto } from './dto/addTeamMember.dto';
import { CreateTeamDto } from './dto/createTeam.dto';
import { UpdateTeamDto } from './dto/updateTeam.dto';

// How many people the teams list shows per team (the row of initials).
const MEMBER_PREVIEW_SIZE = 5;

// "Rahul Verma" -> "RV", "Priyanshu" -> "P".
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  // ---------- Reading (any role) ----------

  async listTeams(organizationId: string) {
    const teams = await this.prisma.team.findMany({
      where: { organizationId },
      include: { members: { include: { user: true } } },
      orderBy: { name: 'asc' },
    });

    return {
      data: teams.map((team) => {
        const people = team.members
          .map((member) => member.user)
          .sort((a, b) => a.name.localeCompare(b.name));

        return {
          id: team.id,
          name: team.name,
          slug: team.slug,
          memberCount: people.length,
          // TODO (services): count the team's services once they exist.
          serviceCount: 0,
          members: people.slice(0, MEMBER_PREVIEW_SIZE).map((user) => ({
            userId: user.id,
            name: user.name,
            initials: initialsOf(user.name),
          })),
        };
      }),
    };
  }

  async getTeam(organizationId: string, teamId: string) {
    const team = await this.findTeamOrThrow(organizationId, teamId);

    // Each person's organization role, to show next to their name.
    const memberships = await this.prisma.membership.findMany({
      where: {
        organizationId,
        user: { teamMemberships: { some: { teamId } } },
      },
      include: { user: true },
    });

    const members = memberships
      .map((membership) => ({
        userId: membership.userId,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      members,
      // TODO (services, schedules): fill these in once those exist.
      services: [] as { id: string; name: string }[],
      schedules: [] as { id: string; name: string }[],
    };
  }

  // ---------- Changing (owners and admins) ----------

  async createTeam(
    currentUserId: string,
    organizationId: string,
    dto: CreateTeamDto,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );

    const slug = await this.makeFreeSlug(organizationId, dto.name);
    const memberIds = dto.memberIds ?? [];
    await this.assertAllInOrganization(organizationId, memberIds);

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        slug,
        organizationId,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
    });

    return this.getTeam(organizationId, team.id);
  }

  async updateTeam(
    currentUserId: string,
    organizationId: string,
    teamId: string,
    dto: UpdateTeamDto,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
    const team = await this.findTeamOrThrow(organizationId, teamId);

    // The slug follows the name. `team.id` is passed so that renaming a
    // team to something with the same slug doesn't clash with itself.
    const slug = await this.makeFreeSlug(organizationId, dto.name, team.id);

    await this.prisma.team.update({
      where: { id: team.id },
      data: { name: dto.name, slug },
    });

    return this.getTeam(organizationId, team.id);
  }

  async deleteTeam(
    currentUserId: string,
    organizationId: string,
    teamId: string,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
    const team = await this.findTeamOrThrow(organizationId, teamId);

    // TODO (services, schedules): once those exist, refuse with a 409 while
    // any still belong to this team, e.g.
    //   throw new ConflictException({ message: 'Team owns 2 services', services })
    // so nothing is left without an owner.

    // The team's member rows go with it (onDelete: Cascade in the schema).
    await this.prisma.team.delete({ where: { id: team.id } });
  }

  async addTeamMember(
    currentUserId: string,
    organizationId: string,
    teamId: string,
    dto: AddTeamMemberDto,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
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

    // upsert = "add them unless they're already there", so adding someone
    // twice quietly does nothing instead of failing.
    await this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: dto.userId } },
      create: { teamId: team.id, userId: dto.userId },
      update: {},
    });

    return {
      teamId: team.id,
      userId: dto.userId,
      name: membership.user.name,
    };
  }

  // `force` will matter once schedules exist: removing someone who is on
  // one of the team's schedules needs the caller to confirm first.
  async removeTeamMember(
    currentUserId: string,
    organizationId: string,
    teamId: string,
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    force: boolean,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
    const team = await this.findTeamOrThrow(organizationId, teamId);

    // TODO (schedules): if this user is on one of the team's schedules and
    // `force` is false, refuse with a 409 that lists them, e.g.
    //   throw new ConflictException({ message: 'User is on 1 schedule', schedules })

    // deleteMany rather than delete: removing someone who isn't on the
    // team is simply nothing to do, not an error.
    await this.prisma.teamMember.deleteMany({
      where: { teamId: team.id, userId },
    });
  }

  // ---------- Helpers ----------

  // Looking the team up together with organizationId is what stops one
  // organization from reading or changing another's teams.
  private async findTeamOrThrow(organizationId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  // Turns a name into a slug and makes sure no other team in the
  // organization already has it.
  private async makeFreeSlug(
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

    const taken = await this.prisma.team.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
    });
    if (taken && taken.id !== ignoreTeamId) {
      throw new ConflictException(
        `A team named "${taken.name}" already exists`,
      );
    }

    return slug;
  }

  private async assertAllInOrganization(
    organizationId: string,
    userIds: string[],
  ) {
    if (userIds.length === 0) return;

    const found = await this.prisma.membership.count({
      where: { organizationId, userId: { in: userIds } },
    });
    if (found !== userIds.length) {
      throw new BadRequestException(
        'Every team member must already be in your organization',
      );
    }
  }
}
