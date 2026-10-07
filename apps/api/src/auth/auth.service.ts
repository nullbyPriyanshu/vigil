import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';
import { Prisma, type Membership } from '../generated/prisma/client';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  BCRYPT_ROUNDS,
  LOGIN_LOCK_SECONDS,
  MAX_LOGIN_FAILS,
  MAX_RESET_REQUESTS,
  PASSWORD_RESET_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  RESET_REQUEST_WINDOW_SECONDS,
} from './auth.constants';
import { RedisService } from '../redis/redis.service';
import type { JwtPayload } from './auth.guard';

const FORGOT_PASSWORD_MESSAGE =
  'If an account exists with this email, a password reset link has been sent.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mailService: MailService,
    private readonly redis: RedisService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const slug = this.slugify(dto.organizationName);
    if (!slug) {
      throw new BadRequestException(
        'Organization name must contain at least one letter or number',
      );
    }

    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug },
    });
    if (existingOrg) {
      throw new ConflictException(
        `An organization named "${existingOrg.name}" already exists`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            timezone: dto.timezone ?? 'Asia/Kolkata',
          },
        });

        const organization = await tx.organization.create({
          data: { name: dto.organizationName, slug },
        });

        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: 'OWNER',
          },
        });

        return { user, organization };
      });

      return {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          timezone: result.user.timezone,
        },
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
        },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account or organization with these details already exists',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const failsKey = `login-fails:${dto.email}`;
    const fails = Number(await this.redis.get(failsKey));
    if (fails >= MAX_LOGIN_FAILS) {
      const seconds = await this.redis.ttl(failsKey);
      const minutes = Math.max(1, Math.ceil(seconds / 60));
      throw new HttpException(
        `Too many wrong passwords. Try again in ${minutes} minutes`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { memberships: { orderBy: { createdAt: 'asc' } } },
    });

    const invalid = new UnauthorizedException('Invalid email or password');

    if (!user) {
      await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      await this.countLoginFail(failsKey);
      throw invalid;
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      await this.countLoginFail(failsKey);
      throw invalid;
    }

    await this.redis.del(failsKey);

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException(
        'This account does not belong to any organization',
      );
    }

    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    const tokens = await this.issueTokens(user.id, membership);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        timezone: user.timezone,
      },
      organizationId: membership.organizationId,
      role: membership.role,
    };
  }

  async me(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, organizationId },
      include: { user: true, organization: true },
    });

    if (!membership) throw new UnauthorizedException();

    return {
      user: {
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        timezone: membership.user.timezone,
      },
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
      role: membership.role,
    };
  }

  async refresh(refreshToken: string | undefined) {
    const invalid = new UnauthorizedException(
      'Session expired, please log in again',
    );

    if (!refreshToken) throw invalid;

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
    });

    if (!stored || stored.expiresAt <= new Date()) throw invalid;

    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { id: stored.id },
    });
    if (count === 0) throw invalid;

    const membership = await this.findSessionMembership(
      stored.userId,
      stored.organizationId,
    );
    if (!membership) throw invalid;

    return this.issueTokens(stored.userId, membership);
  }

  // A session stays in the organization it was started for. Older sessions
  // (and anyone no longer in that organization) fall back to the user's
  // first organization.
  private async findSessionMembership(
    userId: string,
    organizationId: string | null,
  ) {
    if (organizationId) {
      const membership = await this.prisma.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
      });
      if (membership) return membership;
    }

    return this.prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;

    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash: this.hashToken(refreshToken) },
    });
  }

  async forgotPassword(email: string) {
    const requestsKey = `reset-requests:${email}`;
    const requests = await this.redis.incr(requestsKey);
    if (requests === 1) {
      await this.redis.expire(requestsKey, RESET_REQUEST_WINDOW_SECONDS);
    }
    if (requests > MAX_RESET_REQUESTS) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const resetToken = this.generateToken();

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          tokenHash: this.hashToken(resetToken),
          userId: user.id,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      }),
    ]);

    try {
      await this.mailService.sendForgotPasswordEmail(
        user.email,
        user.name,
        resetToken,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to user ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const passwordReset = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(dto.token) },
      include: { user: true },
    });

    if (!passwordReset || passwordReset.expiresAt <= new Date()) {
      if (passwordReset) {
        await this.prisma.passwordResetToken.delete({
          where: { id: passwordReset.id },
        });
      }

      throw new BadRequestException('Invalid or expired password reset link');
    }

    const { user } = passwordReset;
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.delete({
        where: { id: passwordReset.id },
      }),

      this.prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    try {
      await this.mailService.sendPasswordResetSuccessEmail(
        user.email,
        user.name,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send password reset confirmation to user ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return { message: 'Password reset successfully' };
  }

  // Public so other modules can start a session too (accepting an
  // invitation logs the person straight into the organization they joined).
  async issueTokens(
    userId: string,
    membership: Pick<Membership, 'organizationId' | 'role'>,
  ) {
    const payload: JwtPayload = {
      sub: userId,
      orgId: membership.organizationId,
      role: membership.role,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = this.generateToken();
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId,
        organizationId: membership.organizationId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }

  private generateToken() {
    return randomBytes(32).toString('hex');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async countLoginFail(failsKey: string) {
    const fails = await this.redis.incr(failsKey);
    if (fails === 1) {
      await this.redis.expire(failsKey, LOGIN_LOCK_SECONDS);
    }
  }
}
