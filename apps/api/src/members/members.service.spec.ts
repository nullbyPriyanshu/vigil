import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { MembersService } from './members.service';

function createPrismaMock() {
  return {
    membership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    refreshToken: { deleteMany: jest.fn() },
    teamMember: { deleteMany: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
}

const row = (userId: string, name: string, role: string) => ({
  userId,
  role,
  createdAt: new Date('2026-01-05'),
  user: { name, email: `${userId}@acme.com`, timezone: 'Asia/Kolkata' },
});

describe('MembersService', () => {
  let service: MembersService;
  let prisma: ReturnType<typeof createPrismaMock>;

  // Answers membership lookups the way the real table would.
  const setMembers = (members: Record<string, string>) => {
    prisma.membership.findUnique.mockImplementation(
      ({ where }: { where: { userId_organizationId: { userId: string } } }) => {
        const userId = where.userId_organizationId.userId;
        return Promise.resolve(
          members[userId] ? { userId, role: members[userId] } : null,
        );
      },
    );
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [MembersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(MembersService);
  });

  describe('listMembers', () => {
    it('sorts owner, admins, responders, viewers, then by name', async () => {
      prisma.membership.findMany.mockResolvedValue([
        row('u1', 'Zara', 'VIEWER'),
        row('u2', 'Rahul', 'ADMIN'),
        row('u3', 'Sneha', 'RESPONDER'),
        row('u4', 'Priyanshu', 'OWNER'),
        row('u5', 'Aman', 'ADMIN'),
      ]);

      const { data } = await service.listMembers('o1');

      expect(data.map((m) => `${m.role}:${m.name}`)).toEqual([
        'OWNER:Priyanshu',
        'ADMIN:Aman',
        'ADMIN:Rahul',
        'RESPONDER:Sneha',
        'VIEWER:Zara',
      ]);
    });

    it('returns the documented fields and nothing sensitive', async () => {
      prisma.membership.findMany.mockResolvedValue([
        row('u1', 'Priyanshu', 'OWNER'),
      ]);

      const { data } = await service.listMembers('o1');

      expect(Object.keys(data[0]).sort()).toEqual(
        ['email', 'joinedAt', 'name', 'role', 'timezone', 'userId'].sort(),
      );
    });
  });

  describe('updateMemberRole', () => {
    it('rejects a caller whose real role is not owner or admin', async () => {
      setMembers({ me: 'RESPONDER', them: 'VIEWER' });

      await expect(
        service.updateMemberRole('me', 'o1', 'them', { role: 'ADMIN' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects changing your own role', async () => {
      setMembers({ me: 'ADMIN' });

      await expect(
        service.updateMemberRole('me', 'o1', 'me', { role: 'VIEWER' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects changing the owner', async () => {
      setMembers({ me: 'ADMIN', boss: 'OWNER' });

      await expect(
        service.updateMemberRole('me', 'o1', 'boss', { role: 'VIEWER' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('throws 404 for someone who is not a member', async () => {
      setMembers({ me: 'OWNER' });

      await expect(
        service.updateMemberRole('me', 'o1', 'stranger', { role: 'ADMIN' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('saves the new role and returns the member', async () => {
      setMembers({ me: 'OWNER', them: 'VIEWER' });
      prisma.membership.update.mockResolvedValue(
        row('them', 'Sneha', 'RESPONDER'),
      );

      const result = await service.updateMemberRole('me', 'o1', 'them', {
        role: 'RESPONDER',
      });

      expect(prisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'RESPONDER' } }),
      );
      expect(result).toMatchObject({
        userId: 'them',
        name: 'Sneha',
        role: 'RESPONDER',
      });
    });
  });

  describe('removeMember', () => {
    it('rejects a caller whose real role is not owner or admin', async () => {
      setMembers({ me: 'VIEWER', them: 'VIEWER' });

      await expect(
        service.removeMember('me', 'o1', 'them'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects removing yourself', async () => {
      setMembers({ me: 'OWNER' });

      await expect(
        service.removeMember('me', 'o1', 'me'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects removing the owner', async () => {
      setMembers({ me: 'ADMIN', boss: 'OWNER' });

      await expect(
        service.removeMember('me', 'o1', 'boss'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });

    it('throws 404 for someone who is not a member', async () => {
      setMembers({ me: 'OWNER' });

      await expect(
        service.removeMember('me', 'o1', 'stranger'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes the membership, signs the user out and takes them off teams', async () => {
      setMembers({ me: 'ADMIN', them: 'RESPONDER' });

      await service.removeMember('me', 'o1', 'them');

      expect(prisma.membership.delete).toHaveBeenCalledWith({
        where: {
          userId_organizationId: { userId: 'them', organizationId: 'o1' },
        },
      });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'them' },
      });
      expect(prisma.teamMember.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'them', team: { organizationId: 'o1' } },
      });
    });
  });
});
