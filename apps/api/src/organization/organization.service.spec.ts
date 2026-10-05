import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { OrganizationService } from './organization.service';

function createPrismaMock() {
  return {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    membership: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
}

const ORG = {
  id: 'o1',
  name: 'Acme Corp',
  slug: 'acme-corp',
  onboardingCompletedAt: null,
  createdAt: new Date('2026-01-05'),
  _count: { memberships: 3 },
};

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: ReturnType<typeof createPrismaMock>;

  // Answers membership lookups the way the real table would.
  const setMembers = (members: Record<string, string>) => {
    prisma.membership.findUnique.mockImplementation(
      ({ where }: { where: { userId_organizationId: { userId: string } } }) => {
        const userId = where.userId_organizationId.userId;
        return Promise.resolve(
          members[userId]
            ? { id: `m-${userId}`, userId, role: members[userId] }
            : null,
        );
      },
    );
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(OrganizationService);
  });

  describe('getOrganization', () => {
    it('returns the organization with its member count', async () => {
      prisma.organization.findUnique.mockResolvedValue(ORG);

      await expect(service.getOrganization('o1')).resolves.toEqual({
        id: 'o1',
        name: 'Acme Corp',
        slug: 'acme-corp',
        memberCount: 3,
        onboardingCompletedAt: null,
        createdAt: ORG.createdAt,
      });
    });

    it('throws 404 when the organization is gone', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.getOrganization('o1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateOrganization', () => {
    it('rejects an empty update', async () => {
      await expect(service.updateOrganization('o1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a slug another organization already uses', async () => {
      prisma.organization.findUnique
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce({ id: 'o2', slug: 'taken' });

      await expect(
        service.updateOrganization('o1', { slug: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('saves the new name and slug', async () => {
      prisma.organization.findUnique
        .mockResolvedValueOnce(ORG) // load current
        .mockResolvedValueOnce(null) // slug is free
        .mockResolvedValueOnce(null) // name is free
        .mockResolvedValueOnce({ ...ORG, name: 'Acme', slug: 'acme' });

      const result = await service.updateOrganization('o1', {
        name: 'Acme',
        slug: 'acme',
      });

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { name: 'Acme', slug: 'acme' },
      });
      expect(result.slug).toBe('acme');
    });

    it('does not check uniqueness when the slug is unchanged', async () => {
      prisma.organization.findUnique
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce(ORG);

      await service.updateOrganization('o1', { slug: 'acme-corp' });

      expect(prisma.organization.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('transferOwnership', () => {
    it('rejects a caller who is not the owner (even if the token said so)', async () => {
      setMembers({ me: 'ADMIN', them: 'RESPONDER' });

      await expect(
        service.transferOwnership('me', 'o1', { userId: 'them' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects transferring to yourself', async () => {
      setMembers({ me: 'OWNER' });

      await expect(
        service.transferOwnership('me', 'o1', { userId: 'me' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a target who is not a member', async () => {
      setMembers({ me: 'OWNER' });

      await expect(
        service.transferOwnership('me', 'o1', { userId: 'stranger' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('demotes the owner and promotes the target together', async () => {
      setMembers({ me: 'OWNER', them: 'RESPONDER' });

      const result = await service.transferOwnership('me', 'o1', {
        userId: 'them',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'ADMIN' } }),
      );
      expect(prisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'OWNER' } }),
      );
      expect(result).toEqual({
        previousOwner: { userId: 'me', role: 'ADMIN' },
        newOwner: { userId: 'them', role: 'OWNER' },
      });
    });
  });

  describe('deleteOrganization', () => {
    it('rejects a caller who is not the owner', async () => {
      setMembers({ me: 'ADMIN' });

      await expect(
        service.deleteOrganization('me', 'o1', { confirmName: 'Acme Corp' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a name that does not match exactly', async () => {
      setMembers({ me: 'OWNER' });
      prisma.organization.findUnique.mockResolvedValue(ORG);

      await expect(
        service.deleteOrganization('me', 'o1', { confirmName: 'acme corp' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.organization.delete).not.toHaveBeenCalled();
    });

    it('deletes when the name matches', async () => {
      setMembers({ me: 'OWNER' });
      prisma.organization.findUnique.mockResolvedValue(ORG);

      await service.deleteOrganization('me', 'o1', {
        confirmName: 'Acme Corp',
      });

      expect(prisma.organization.delete).toHaveBeenCalledWith({
        where: { id: 'o1' },
      });
    });
  });

  describe('completeOnboarding', () => {
    it('sets the timestamp the first time', async () => {
      const now = new Date();
      prisma.organization.findUnique.mockResolvedValue(ORG);
      prisma.organization.update.mockResolvedValue({
        ...ORG,
        onboardingCompletedAt: now,
      });

      await expect(service.completeOnboarding('o1')).resolves.toEqual({
        onboardingCompletedAt: now,
      });
    });

    it('keeps the first timestamp when called again', async () => {
      const first = new Date('2026-03-01T10:12:00Z');
      prisma.organization.findUnique.mockResolvedValue({
        ...ORG,
        onboardingCompletedAt: first,
      });

      await expect(service.completeOnboarding('o1')).resolves.toEqual({
        onboardingCompletedAt: first,
      });
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });
  });
});
