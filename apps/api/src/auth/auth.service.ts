import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { SignupDto } from './dto/signup.dto';
import { slugify } from './utils/slugify';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const slug = slugify(dto.organizationName);

    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug },
    });
    if (existingOrg) {
      throw new ConflictException(
        `An organization named "${existingOrg.name}" already exists`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

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
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { memberships: true },
    });

    const invalid = new UnauthorizedException('Invalid email or password');

    if (!user) {
      await bcrypt.hash(dto.password, 10);
      throw invalid;
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) throw invalid;

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException(
        'This account does not belong to any organization',
      );
    }

    const access_token = await this.jwt.signAsync({
      sub: user.id,
      orgId: membership.organizationId,
      role: membership.role,
    });

    const refresh_token = await this.jwt.signAsync({
      sub: user.id,
      orgId: membership.organizationId,
      role: membership.role,
    });

    await this.prisma.refreshToken.create({
      data: {
        token: refresh_token,
        userId: user.id,
      },
    });

    return {
      access_token,
      refresh_token,
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

  async refresh(refresh_token) {
    const token = await this.prisma.refreshToken.findFirst({
      where: {
        token: refresh_token,
      },
    });

    if (!token) {
      throw new NotFoundException('Inavlid Session!');
    }

    const user = await this.jwt.verifyAsync(token.token);

    const access_token = await this.jwt.signAsync({
      sub: user.sub,
      orgId: user.orgId,
      role: user.role,
    });

    const new_refresh_token = await this.jwt.signAsync({
      sub: user.sub,
      orgId: user.orgId,
      role: user.role,
    });

    return {
      access_token,
      refresh_token: new_refresh_token,
    };
  }
}
