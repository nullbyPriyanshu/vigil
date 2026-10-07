import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma.service';
import { ApiKeysService } from './api-keys.service';
import { generateApiKey, hashApiKey } from './utils/apiKey';

function createPrismaMock() {
  return {
    service: { findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
    apiKey: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let members: { assertCanManageMembers: jest.Mock };

  beforeEach(async () => {
    process.env.API_KEY_PEPPER = 'test-pepper';
    prisma = createPrismaMock();
    members = { assertCanManageMembers: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembersService, useValue: members },
      ],
    }).compile();
    service = moduleRef.get(ApiKeysService);
  });

  it('generates vgl_live_ + 48 hex characters, with the first 8 as the prefix', () => {
    const { key, prefix } = generateApiKey();

    expect(key).toMatch(/^vgl_live_[0-9a-f]{48}$/);
    expect(key.slice(9, 17)).toBe(prefix);
  });

  it('hashes with the pepper, so a different pepper gives a different hash', () => {
    const first = hashApiKey('vgl_live_abc');
    process.env.API_KEY_PEPPER = 'another-pepper';

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey('vgl_live_abc')).not.toBe(first);
  });

  it('lists keys without the hash', async () => {
    prisma.apiKey.findMany.mockResolvedValue([
      {
        id: 'k1',
        name: 'Sentry',
        prefix: '8f3c9a2e',
        keyHash: 'secret',
        lastUsedAt: null,
        revokedAt: null,
        createdAt: new Date(),
        serviceId: 's1',
      },
    ]);

    const result = await service.listKeys('u1', 'o1', 's1');

    expect(Object.keys(result.data[0]).sort()).toEqual(
      ['createdAt', 'id', 'lastUsedAt', 'name', 'prefix', 'revokedAt'].sort(),
    );
  });

  it('refuses someone who cannot manage the organization', async () => {
    members.assertCanManageMembers.mockRejectedValue(new ForbiddenException());

    await expect(service.listKeys('u1', 'o1', 's1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.apiKey.findMany).not.toHaveBeenCalled();
  });

  it('gives 404 for a service in another organization', async () => {
    prisma.service.findFirst.mockResolvedValue(null);

    await expect(
      service.listKeys('u1', 'o1', 's-other'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the raw key once and stores only its hash and prefix', async () => {
    prisma.apiKey.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: 'k1',
        createdAt: new Date(),
        ...data,
      }),
    );

    const result = await service.createKey('u1', 'o1', 's1', {
      name: 'Sentry',
    });

    const stored = (
      prisma.apiKey.create.mock.calls[0] as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(result.key).toMatch(/^vgl_live_[0-9a-f]{48}$/);
    expect(stored).toEqual({
      name: 'Sentry',
      prefix: result.prefix,
      keyHash: hashApiKey(result.key),
      serviceId: 's1',
    });
  });

  it('gives 404 when revoking a key that is not on this service', async () => {
    prisma.apiKey.findFirst.mockResolvedValue(null);

    await expect(
      service.revokeKey('u1', 'o1', 's1', 'k-other'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
      where: { id: 'k-other', serviceId: 's1' },
    });
  });

  it('keeps the first revoke time when revoked again', async () => {
    const revokedAt = new Date('2026-03-03');
    prisma.apiKey.findFirst.mockResolvedValue({ id: 'k1', revokedAt });

    await expect(service.revokeKey('u1', 'o1', 's1', 'k1')).resolves.toEqual({
      id: 'k1',
      revokedAt,
    });
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it('finds an active key by its hash, and nothing for unknown or revoked keys', async () => {
    prisma.apiKey.findUnique.mockResolvedValue({
      id: 'k1',
      revokedAt: null,
      serviceId: 's1',
      service: { organizationId: 'o1' },
    });
    await expect(service.findActiveKey('vgl_live_x')).resolves.toEqual({
      id: 'k1',
      serviceId: 's1',
      organizationId: 'o1',
    });
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
      where: { keyHash: hashApiKey('vgl_live_x') },
      include: { service: true },
    });

    prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(service.findActiveKey('vgl_live_x')).resolves.toBeNull();

    prisma.apiKey.findUnique.mockResolvedValue({
      id: 'k1',
      revokedAt: new Date(),
      serviceId: 's1',
      service: { organizationId: 'o1' },
    });
    await expect(service.findActiveKey('vgl_live_x')).resolves.toBeNull();
  });
});
