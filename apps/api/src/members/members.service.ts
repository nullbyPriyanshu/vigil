import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ROLE_ORDER, canManageMembers } from 'src/common/permissions';
import { Role } from 'src/generated/prisma/enums';
import { UpdateMemberRoleDto } from './dto/updateMemberRole.dto';

type MembershipWithUser = {
  userId: string;
  role: Role;
  createdAt: Date;
  user: { name: string; email: string; timezone: string };
};

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers(organizationId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId },
      include: { user: true },
    });

    const members = memberships.map((membership) => this.toMember(membership));

    // Owner first, then admins, responders, viewers. Same role: by name.
    members.sort((a, b) => {
      const byRole = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
      if (byRole !== 0) return byRole;
      return a.name.localeCompare(b.name);
    });

    return { data: members };
  }

  async updateMemberRole(
    currentUserId: string,
    organizationId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.assertCanManageMembers(currentUserId, organizationId);

    if (targetUserId === currentUserId) {
      throw new BadRequestException('You cannot change your own role');
    }

    const target = await this.findMemberOrThrow(targetUserId, organizationId);

    if (target.role === 'OWNER') {
      throw new BadRequestException(
        "The owner's role cannot be changed. Transfer ownership instead.",
      );
    }

    const updated = await this.prisma.membership.update({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId },
      },
      data: { role: dto.role },
      include: { user: true },
    });

    return this.toMember(updated);
  }

  async removeMember(
    currentUserId: string,
    organizationId: string,
    targetUserId: string,
  ) {
    await this.assertCanManageMembers(currentUserId, organizationId);

    if (targetUserId === currentUserId) {
      throw new BadRequestException(
        'You cannot remove yourself from the organization',
      );
    }

    const target = await this.findMemberOrThrow(targetUserId, organizationId);

    if (target.role === 'OWNER') {
      throw new BadRequestException('The owner cannot be removed');
    }

    const schedules = await this.prisma.schedule.findMany({
      where: {
        organizationId,
        participants: { some: { userId: targetUserId } },
      },
    });
    if (schedules.length > 0) {
      const word = schedules.length === 1 ? 'schedule' : 'schedules';
      throw new ConflictException({
        message: `User is on ${schedules.length} ${word}. Take them off the rotation first`,
        schedules: schedules.map((schedule) => ({
          id: schedule.id,
          name: schedule.name,
        })),
      });
    }

    // Only the membership goes. The user's account stays, and without a
    // membership they can no longer log in or refresh their session.
    await this.prisma.$transaction([
      this.prisma.membership.delete({
        where: {
          userId_organizationId: { userId: targetUserId, organizationId },
        },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: targetUserId },
      }),
      // Leaving the organization also takes them off its teams.
      this.prisma.teamMember.deleteMany({
        where: { userId: targetUserId, team: { organizationId } },
      }),
    ]);
  }

  // The role inside the login token can be up to an hour old, so read the
  // caller's real role from the database before letting them change anyone.
  async assertCanManageMembers(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (!membership || !canManageMembers(membership.role)) {
      throw new ForbiddenException('Only owners and admins can manage members');
    }
  }

  private async findMemberOrThrow(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (!membership) {
      throw new NotFoundException(
        'This user is not a member of your organization',
      );
    }

    return membership;
  }

  private toMember(membership: MembershipWithUser) {
    return {
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      timezone: membership.user.timezone,
      joinedAt: membership.createdAt,
    };
  }
}
