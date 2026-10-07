import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma.service';
import { BCRYPT_ROUNDS } from 'src/auth/auth.constants';
import { MailService } from 'src/mail/mail.service';
import { UpdateUserProfileDto } from './dto/updateUserProfile.dto';
import { UpdateUserPasswordDto } from './dto/updateUserPassword.dto';
import { UpdateUserEmailDto } from './dto/updateUserEmail.dto';
import { DeleteAccountDto } from './dto/deleteAccount.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async getUserProfile(userId: string) {
    const user = await this.findUserOrThrow(userId);

    return this.toProfile(user);
  }

  async updateUserProfile(userId: string, dto: UpdateUserProfileDto) {
    if (
      dto.name === undefined &&
      dto.timezone === undefined &&
      dto.emailNotifications === undefined
    ) {
      throw new BadRequestException('Nothing to update');
    }

    await this.findUserOrThrow(userId);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        timezone: dto.timezone,
        emailNotifications: dto.emailNotifications,
      },
    });

    return this.toProfile(updatedUser);
  }

  async updateUserPassword(
    userId: string,
    dto: UpdateUserPasswordDto,
    currentRefreshToken?: string,
  ) {
    const user = await this.findUserOrThrow(userId);

    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),

      this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          ...(currentRefreshToken && {
            tokenHash: { not: this.hashToken(currentRefreshToken) },
          }),
        },
      }),
    ]);

    try {
      await this.mailService.sendPasswordChangedEmail(
        user.email,
        user.name,
        user.timezone,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send password changed email to user ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return { message: 'Password changed' };
  }

  async updateUserEmail(userId: string, dto: UpdateUserEmailDto) {
    const user = await this.findUserOrThrow(userId);

    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.email === user.email) {
      throw new BadRequestException('That is already your email address');
    }

    const taken = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (taken) {
      throw new ConflictException('Another account already uses this email');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { email: dto.email },
    });

    return this.toProfile(updatedUser);
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.findUserOrThrow(userId);

    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }

    const owned = await this.prisma.membership.findMany({
      where: { userId, role: 'OWNER' },
      include: { organization: { include: { memberships: true } } },
    });

    const shared = owned.filter(
      (membership) => membership.organization.memberships.length > 1,
    );
    if (shared.length > 0) {
      const names = shared.map((membership) => membership.organization.name);
      throw new ConflictException(
        `You own ${names.join(', ')}, which has other members. Transfer ownership or delete the organization first`,
      );
    }

    for (const membership of owned) {
      const organizationId = membership.organizationId;
      await this.prisma.service.deleteMany({ where: { organizationId } });
      await this.prisma.escalationPolicy.deleteMany({
        where: { organizationId },
      });
      await this.prisma.schedule.deleteMany({ where: { organizationId } });
      await this.prisma.organization.delete({ where: { id: organizationId } });
    }

    await this.prisma.user.delete({ where: { id: userId } });

    return { message: 'Account deleted' };
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private toProfile(user: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    emailNotifications: boolean;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      emailNotifications: user.emailNotifications,
      createdAt: user.createdAt,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
