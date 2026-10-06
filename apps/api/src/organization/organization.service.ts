import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';
import { TransferOwnershipDto } from './dto/transferOwnership.dto';
import { DeleteOrganizationDto } from './dto/deleteOrganization.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { _count: { select: { memberships: true } } },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      memberCount: organization._count.memberships,
      onboardingCompletedAt: organization.onboardingCompletedAt,
      createdAt: organization.createdAt,
    };
  }

  async updateOrganization(organizationId: string, dto: UpdateOrganizationDto) {
    if (dto.name === undefined && dto.slug === undefined) {
      throw new BadRequestException('Nothing to update');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (dto.slug !== undefined && dto.slug !== organization.slug) {
      const slugOwner = await this.prisma.organization.findUnique({
        where: { slug: dto.slug },
      });
      if (slugOwner) {
        throw new ConflictException('This slug is already taken');
      }
    }

    if (dto.name !== undefined && dto.name !== organization.name) {
      const nameOwner = await this.prisma.organization.findUnique({
        where: { name: dto.name },
      });
      if (nameOwner) {
        throw new ConflictException(
          'An organization with this name already exists',
        );
      }
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: dto.name, slug: dto.slug },
    });

    return this.getOrganization(organizationId);
  }

  async transferOwnership(
    currentUserId: string,
    organizationId: string,
    dto: TransferOwnershipDto,
  ) {
    await this.assertIsOwner(currentUserId, organizationId);

    if (dto.userId === currentUserId) {
      throw new BadRequestException('You already own this organization');
    }

    const target = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId: dto.userId, organizationId },
      },
    });
    if (!target) {
      throw new BadRequestException(
        'This user is not a member of your organization',
      );
    }

    await this.prisma.$transaction([
      this.prisma.membership.update({
        where: {
          userId_organizationId: { userId: currentUserId, organizationId },
        },
        data: { role: 'ADMIN' },
      }),
      this.prisma.membership.update({
        where: { id: target.id },
        data: { role: 'OWNER' },
      }),
    ]);

    return {
      previousOwner: { userId: currentUserId, role: 'ADMIN' },
      newOwner: { userId: dto.userId, role: 'OWNER' },
    };
  }

  async deleteOrganization(
    currentUserId: string,
    organizationId: string,
    dto: DeleteOrganizationDto,
  ) {
    await this.assertIsOwner(currentUserId, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (dto.confirmName !== organization.name) {
      throw new BadRequestException(
        'The name you typed does not match the organization name',
      );
    }
    // Everything else that belongs to the organization is removed with it
    // automatically (onDelete: Cascade in the schema). Services go first,
    // by hand, because a service holds on to its team and policy: with them
    // out of the way, nothing can block the rest.
    await this.prisma.$transaction([
      this.prisma.service.deleteMany({ where: { organizationId } }),
      this.prisma.organization.delete({ where: { id: organizationId } }),
    ]);
  }

  async completeOnboarding(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.onboardingCompletedAt) {
      return { onboardingCompletedAt: organization.onboardingCompletedAt };
    }

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingCompletedAt: new Date() },
    });

    return { onboardingCompletedAt: updated.onboardingCompletedAt };
  }

  private async assertIsOwner(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException('Only the organization owner can do this');
    }
  }
}
