import { createHash } from 'crypto';
import {
  BadRequestException,
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
