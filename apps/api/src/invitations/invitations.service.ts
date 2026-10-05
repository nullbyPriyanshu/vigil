import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from 'src/auth/auth.service';
import { BCRYPT_ROUNDS, INVITATION_TTL_MS } from 'src/auth/auth.constants';
import type { CurrentUserPayload } from 'src/auth/auth.guard';
import { generateToken, hashToken } from 'src/auth/utils/tokens';
import { ROLE_LABELS } from 'src/common/permissions';
import { Role } from 'src/generated/prisma/enums';
import { MailService } from 'src/mail/mail.service';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { AcceptInvitationDto } from './dto/acceptInvitation.dto';
import { CreateInvitationDto } from './dto/createInvitation.dto';

type InvitationWithInviter = {
  id: string;
  email: string;
  role: Role;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { id: string; name: string };
};

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly membersService: MembersService,
    private readonly authService: AuthService,
  ) {}

  // ---------- For owners and admins ----------

  async createInvitation(
    currentUserId: string,
    organizationId: string,
    dto: CreateInvitationDto,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );

    // Nothing to do if this person is already in the organization.
    const existingMember = await this.prisma.membership.findFirst({
      where: { organizationId, user: { email: dto.email } },
    });
    if (existingMember) {
      return { alreadyMember: true as const };
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // The link carries this token; the database only keeps its hash.
    const token = generateToken();

    const [, invitation] = await this.prisma.$transaction([
      // Only the newest invitation for an email should work, so older
      // unaccepted ones are removed first.
      this.prisma.invitation.deleteMany({
        where: { organizationId, email: dto.email, acceptedAt: null },
      }),
      this.prisma.invitation.create({
        data: {
          email: dto.email,
          role: dto.role,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          organizationId,
          invitedById: currentUserId,
        },
        include: { invitedBy: true },
      }),
    ]);

    try {
      await this.mailService.sendInvitationEmail(invitation.email, {
        inviterName: invitation.invitedBy.name,
        organizationName: organization.name,
        roleLabel: ROLE_LABELS[invitation.role],
        token,
        expiresInDays: INVITATION_TTL_MS / (24 * 60 * 60 * 1000),
      });
    } catch (error) {
      // The email is the only place the link exists. Without it the
      // invitation is useless, so remove it and tell the inviter.
      this.logger.error(
        `Failed to send invitation email for invitation ${invitation.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.prisma.invitation.delete({ where: { id: invitation.id } });
      throw new InternalServerErrorException(
        "We couldn't send the invitation email. Please try again.",
      );
    }

    return this.toInvitation(invitation);
  }

  async listInvitations(currentUserId: string, organizationId: string) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );

    // "Pending" means: not accepted, not revoked, not expired.
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

    return {
      data: invitations.map((invitation) => this.toInvitation(invitation)),
    };
  }

  async revokeInvitation(
    currentUserId: string,
    organizationId: string,
    invitationId: string,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );

    // Looking it up together with organizationId means an admin of another
    // organization gets "not found" rather than touching someone else's.
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

  // ---------- For the person who was invited (public) ----------

  async previewInvitation(token: string) {
    const invitation = await this.findUsableInvitationOrThrow(token);

    const account = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    // Only what the invite page needs, nothing else about the organization.
    return {
      organization: { name: invitation.organization.name },
      email: invitation.email,
      role: invitation.role,
      hasAccount: account !== null,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(
    token: string,
    dto: AcceptInvitationDto,
    currentUser: CurrentUserPayload | undefined,
  ) {
    const invitation = await this.findUsableInvitationOrThrow(token);
    const { organization } = invitation;

    const account = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    let userId: string;

    if (account) {
      // The invitation belongs to an existing account, so the person must
      // prove they own it: either they're logged in as that account, or
      // they typed its password.
      if (currentUser) {
        if (currentUser.userId !== account.id) {
          throw new ForbiddenException(
            'This invitation was sent to a different account.',
          );
        }
      } else if (dto.currentPassword) {
        const matches = await bcrypt.compare(
          dto.currentPassword,
          account.passwordHash,
        );
        if (!matches) {
          throw new UnauthorizedException('Incorrect password');
        }
      } else {
        throw new UnauthorizedException(
          'You already have a Vigil account. Log in to accept this invitation.',
        );
      }
      userId = account.id;

      await this.prisma.$transaction(async (tx) => {
        await this.markAccepted(tx, invitation.id);
        // upsert = "create it unless it already exists", which makes
        // accepting safe even for someone who is somehow already a member.
        await tx.membership.upsert({
          where: {
            userId_organizationId: {
              userId: account.id,
              organizationId: organization.id,
            },
          },
          create: {
            userId: account.id,
            organizationId: organization.id,
            role: invitation.role,
          },
          update: {},
        });
      });
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

      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const name = dto.name;

      // All three happen together or not at all.
      userId = await this.prisma.$transaction(async (tx) => {
        await this.markAccepted(tx, invitation.id);
        const user = await tx.user.create({
          data: {
            name,
            email: invitation.email,
            passwordHash,
            timezone: dto.timezone ?? 'Asia/Kolkata',
          },
        });
        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: invitation.role,
          },
        });
        return user.id;
      });
    }

    // Read the role back, in case they were already a member with a
    // different role than the invitation offered.
    const membership = await this.prisma.membership.findUniqueOrThrow({
      where: {
        userId_organizationId: { userId, organizationId: organization.id },
      },
    });

    // Log them straight into the organization they just joined.
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

  // 404 if the link was never real; 410 ("gone") if it was real but can no
  // longer be used.
  private async findUsableInvitationOrThrow(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
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

  // Marks the invitation used, but only if nobody else just did: if two
  // requests arrive at the same moment, the second one changes 0 rows.
  private async markAccepted(
    tx: Pick<PrismaService, 'invitation'>,
    invitationId: string,
  ) {
    const { count } = await tx.invitation.updateMany({
      where: { id: invitationId, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (count === 0) {
      throw new GoneException('This invitation has already been used');
    }
  }

  private toInvitation(invitation: InvitationWithInviter) {
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
}
