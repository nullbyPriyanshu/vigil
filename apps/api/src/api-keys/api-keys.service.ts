import { Injectable, NotFoundException } from '@nestjs/common';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { CreateApiKeyDto } from './dto/createApiKey.dto';
import { generateApiKey, hashApiKey } from './utils/apiKey';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  async listKeys(userId: string, organizationId: string, serviceId: string) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    await this.findServiceOrThrow(organizationId, serviceId);

    const keys = await this.prisma.apiKey.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
    });

    const data = keys.map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt,
    }));

    return { data };
  }

  async createKey(
    userId: string,
    organizationId: string,
    serviceId: string,
    dto: CreateApiKeyDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    await this.findServiceOrThrow(organizationId, serviceId);

    const { key, prefix } = generateApiKey();

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        prefix,
        keyHash: hashApiKey(key),
        serviceId,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      key,
      createdAt: apiKey.createdAt,
    };
  }

  async revokeKey(
    userId: string,
    organizationId: string,
    serviceId: string,
    keyId: string,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    await this.findServiceOrThrow(organizationId, serviceId);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: keyId, serviceId },
    });
    if (!apiKey) {
      throw new NotFoundException('Key not found on this service');
    }

    if (apiKey.revokedAt) {
      return { id: apiKey.id, revokedAt: apiKey.revokedAt };
    }

    const revoked = await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { revokedAt: new Date() },
    });

    return { id: revoked.id, revokedAt: revoked.revokedAt };
  }

  async findActiveKey(key: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(key) },
      include: { service: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      return null;
    }

    return {
      id: apiKey.id,
      serviceId: apiKey.serviceId,
      organizationId: apiKey.service.organizationId,
    };
  }

  async markKeyUsed(keyId: string) {
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  private async findServiceOrThrow(organizationId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, organizationId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }
}
