import { Injectable, NotFoundException } from '@nestjs/common';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { CreateApiKeyDto } from './dto/createApiKey.dto';
import { API_KEY_START, generateApiKey, hashApiKey } from './utils/apiKey';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  // ---------- Managing keys (owners and admins) ----------

  async listKeys(
    currentUserId: string,
    organizationId: string,
    serviceId: string,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
    await this.findServiceOrThrow(organizationId, serviceId);

    const keys = await this.prisma.apiKey.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
    });

    // Only the prefix goes out. The hash never leaves the database.
    return {
      data: keys.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        lastUsedAt: key.lastUsedAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
      })),
    };
  }

  async createKey(
    currentUserId: string,
    organizationId: string,
    serviceId: string,
    dto: CreateApiKeyDto,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
    await this.findServiceOrThrow(organizationId, serviceId);

    const { key, prefix } = generateApiKey();

    const stored = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        prefix,
        keyHash: hashApiKey(key),
        serviceId,
      },
    });

    // This response is the only time the real key exists outside the
    // caller's hands. After this, only its hash is known.
    return {
      id: stored.id,
      name: stored.name,
      prefix: stored.prefix,
      key,
      createdAt: stored.createdAt,
    };
  }

  async revokeKey(
    currentUserId: string,
    organizationId: string,
    serviceId: string,
    keyId: string,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
    await this.findServiceOrThrow(organizationId, serviceId);

    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, serviceId },
    });
    if (!key) {
      throw new NotFoundException('Key not found on this service');
    }

    // Revoking twice keeps the first time.
    if (key.revokedAt) {
      return { id: key.id, revokedAt: key.revokedAt };
    }

    const revoked = await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { revokedAt: new Date() },
    });

    return { id: revoked.id, revokedAt: revoked.revokedAt };
  }

  // ---------- Checking a key (used when an alert arrives) ----------

  // Returns the key and its service when `rawKey` is real and not revoked,
  // otherwise null.
  async findActiveKey(rawKey: string) {
    // Skip the database for things that can't be one of our keys.
    if (!rawKey.startsWith(API_KEY_START)) {
      return null;
    }

    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(rawKey) },
      include: { service: true },
    });

    if (!key || key.revokedAt) {
      return null;
    }

    return {
      id: key.id,
      serviceId: key.serviceId,
      organizationId: key.service.organizationId,
    };
  }

  // Remembers when the key was last used, for "used 4m ago" on the screen.
  async markKeyUsed(keyId: string) {
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  // ---------- Helpers ----------

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
