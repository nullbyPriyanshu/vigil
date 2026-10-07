import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from 'src/auth/auth.service';
import { BCRYPT_ROUNDS, INVITATION_TTL_MS } from 'src/auth/auth.constants';
import type { CurrentUserPayload } from 'src/auth/auth.guard';
import { ROLE_LABELS } from 'src/common/permissions';
import { MailService } from 'src/mail/mail.service';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { AcceptInvitationDto } from './dto/acceptInvitation.dto';
import { CreateInvitationDto } from './dto/createInvitation.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly membersService: MembersService,
    private readonly authService: AuthService,
  ) {}

  async createInvitation(
    userId: string,
    organizationId: string,
    dto: CreateInvitationDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);

    const alreadyMember = await this.prisma.membership.findFirst({
      where: { organizationId, user: { email: dto.email } },
    });
    if (alreadyMember) {
      return { alreadyMember: true };
    }

    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    await this.prisma.invitation.deleteMany({
      where: { organizationId, email: dto.email, acceptedAt: null },
    });

    const token = this.generateToken();
    const invitation = await this.prisma.invitation.create({
      data: {
        email: dto.email,
        role: dto.role,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        organizationId,
        invitedById: userId,
      },
      include: { invitedBy: true },
    });

    try {
      await this.mailService.sendInvitationEmail(invitation.email, {
        inviterName: invitation.invitedBy.name,
        organizationName: organization.name,
        roleLabel: ROLE_LABELS[invitation.role],
        token,
        expiresInDays: INVITATION_TTL_MS / (24 * 60 * 60 * 1000),
      });
    } catch {
      await this.prisma.invitation.delete({ where: { id: invitation.id } });
      throw new InternalServerErrorException(
        "We couldn't send the invitation email. Please try again.",
      );
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      invitedBy: {
        id: invitation.invitedBy.id,
        name: invitation.invitedBy.name,
      },
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  async listInvitations(userId: string, organizationId: string) {
    await this.membersService.assertCanManageMembers(userId, organizationId);

    const invitations = await this.prisma.invitation.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { invitedBy: true },
      orderBy: { createdAt: 'desc' },
    });

    const data = invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      invitedBy: {
        id: invitation.invitedBy.id,
        name: invitation.invitedBy.name,
      },
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    }));

    return { data };
  }

  async revokeInvitation(
    userId: string,
    organizationId: string,
    invitationId: string,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { revokedAt: new Date() },
    });
  }

  async previewInvitation(token: string) {
    const invitation = await this.findUsableInvitation(token);

    const user = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    return {
      organization: { name: invitation.organization.name },
      email: invitation.email,
      role: invitation.role,
      hasAccount: user !== null,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(
    token: string,
    dto: AcceptInvitationDto,
    currentUser: CurrentUserPayload | undefined,
  ) {
    const invitation = await this.findUsableInvitation(token);
    const organization = invitation.organization;

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      await this.checkOwnsAccount(existingUser, dto, currentUser);
    } else {
      if (currentUser) {
        throw new ForbiddenException(
          'This invitation was sent to a different account.',
        );
      }
      if (!dto.name || !dto.password) {
        throw new BadRequestException(
          'Name and password are required to create your account',
        );
      }
    }

    const marked = await this.prisma.invitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (marked.count === 0) {
      throw new GoneException('This invitation has already been used');
    }

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const newUser = await this.prisma.user.create({
        data: {
          name: dto.name!,
          email: invitation.email,
          passwordHash: await bcrypt.hash(dto.password!, BCRYPT_ROUNDS),
          timezone: dto.timezone ?? 'Asia/Kolkata',
        },
      });
      userId = newUser.id;
    }

    let membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: organization.id },
      },
    });
    if (!membership) {
      membership = await this.prisma.membership.create({
        data: {
          userId,
          organizationId: organization.id,
          role: invitation.role,
        },
      });
    }

    const tokens = await this.authService.issueTokens(userId, membership);

    return {
      ...tokens,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      role: membership.role,
    };
  }

  private async checkOwnsAccount(
    account: { id: string; passwordHash: string },
    dto: AcceptInvitationDto,
    currentUser: CurrentUserPayload | undefined,
  ) {
    if (currentUser) {
      if (currentUser.userId !== account.id) {
        throw new ForbiddenException(
          'This invitation was sent to a different account.',
        );
      }
      return;
    }

    if (!dto.currentPassword) {
      throw new UnauthorizedException(
        'You already have a Vigil account. Log in to accept this invitation.',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      account.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Incorrect password');
    }
  }

  private async findUsableInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { organization: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.acceptedAt) {
      throw new GoneException('This invitation has already been used');
    }
    if (invitation.revokedAt) {
      throw new GoneException('This invitation was cancelled');
    }
    if (invitation.expiresAt <= new Date()) {
      throw new GoneException('This invitation has expired');
    }

    return invitation;
  }

  private generateToken() {
    return randomBytes(32).toString('hex');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
