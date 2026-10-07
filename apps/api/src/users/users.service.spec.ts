import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from './users.service';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

jest.mock('../mail/mail.service', () => ({ MailService: class {} }));

const CURRENT = 'Old!Passw0rd';
const NEXT = 'N3w!Passw0rd';

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn<Promise<unknown>, [{ data: { passwordHash: string } }]>(),
      delete: jest.fn(),
    },
    refreshToken: { deleteMany: jest.fn() },
    membership: { findMany: jest.fn().mockResolvedValue([]) },
    service: { deleteMany: jest.fn() },
    escalationPolicy: { deleteMany: jest.fn() },
    schedule: { deleteMany: jest.fn() },
    organization: { delete: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let mail: { sendPasswordChangedEmail: jest.Mock };
  let user: Record<string, unknown>;

  beforeAll(async () => {
    user = {
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      timezone: 'Asia/Kolkata',
      createdAt: new Date('2026-01-01'),
      passwordHash: await bcrypt.hash(CURRENT, 4),
    };
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    mail = { sendPasswordChangedEmail: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('getUserProfile', () => {
    it('never returns the password hash', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      const profile = await service.getUserProfile('u1');

      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile.email).toBe('test@example.com');
    });

    it('throws 404 for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserProfile('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateUserProfile', () => {
    it('rejects an empty update', async () => {
      await expect(service.updateUserProfile('u1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates only the fields that were sent', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({ ...user, name: 'New Name' });

      const profile = await service.updateUserProfile('u1', {
        name: 'New Name',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'New Name', timezone: undefined },
      });
      expect(profile.name).toBe('New Name');
      expect(profile).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateUserPassword', () => {
    it('rejects a wrong current password with 400', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.updateUserPassword('u1', {
          currentPassword: 'wrong',
          newPassword: NEXT,
        }),
      ).rejects.toThrow(
        new BadRequestException('Current password is incorrect'),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('still succeeds when the email fails to send', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      mail.sendPasswordChangedEmail.mockRejectedValue(new Error('down'));
      jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await expect(
        service.updateUserPassword('u1', {
          currentPassword: CURRENT,
          newPassword: NEXT,
        }),
      ).resolves.toEqual({ message: 'Password changed' });
    });

    it('does not email when the current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.updateUserPassword('u1', {
          currentPassword: 'wrong',
          newPassword: NEXT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mail.sendPasswordChangedEmail).not.toHaveBeenCalled();
    });

    it('rejects reusing the current password', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.updateUserPassword('u1', {
          currentPassword: CURRENT,
          newPassword: CURRENT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('saves a new hash and signs out other devices only', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.updateUserPassword(
        'u1',
        { currentPassword: CURRENT, newPassword: NEXT },
        'this-device-token',
      );

      expect(result).toEqual({ message: 'Password changed' });
      expect(mail.sendPasswordChangedEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        'Asia/Kolkata',
      );

      const saved = prisma.user.update.mock.calls[0][0];
      expect(await bcrypt.compare(NEXT, saved.data.passwordHash)).toBe(true);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          tokenHash: { not: hashToken('this-device-token') },
        },
      });
    });
  });

  describe('updateUserEmail and deleteAccount', () => {
    let user: Record<string, unknown>;

    beforeAll(async () => {
      user = {
        id: 'u1',
        name: 'Test',
        email: 'old@acme.com',
        timezone: 'Asia/Kolkata',
        emailNotifications: true,
        createdAt: new Date(),
        passwordHash: await bcrypt.hash(CURRENT, 4),
      };
    });

    it('changes the email when the password is right and the address is free', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null);
      prisma.user.update.mockResolvedValue({ ...user, email: 'new@acme.com' });

      const profile = await service.updateUserEmail('u1', {
        email: 'new@acme.com',
        currentPassword: CURRENT,
      });

      expect(profile.email).toBe('new@acme.com');
    });

    it('refuses an email another account already uses', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ id: 'u2' });

      await expect(
        service.updateUserEmail('u1', {
          email: 'taken@acme.com',
          currentPassword: CURRENT,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses to change the email with a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.updateUserEmail('u1', {
          email: 'new@acme.com',
          currentPassword: 'wrong',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('will not delete someone who owns an organization with other members', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.membership.findMany.mockResolvedValue([
        {
          organizationId: 'o1',
          organization: { name: 'Acme', memberships: [{}, {}] },
        },
      ]);

      await expect(
        service.deleteAccount('u1', { currentPassword: CURRENT }),
      ).rejects.toThrow(
        'You own Acme, which has other members. Transfer ownership or delete the organization first',
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('takes an organization with nobody else in it along', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.membership.findMany.mockResolvedValue([
        {
          organizationId: 'o1',
          organization: { name: 'Solo', memberships: [{}] },
        },
      ]);

      await service.deleteAccount('u1', { currentPassword: CURRENT });

      expect(prisma.organization.delete).toHaveBeenCalledWith({
        where: { id: 'o1' },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });

    it('deletes the account when the password is right', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await service.deleteAccount('u1', { currentPassword: CURRENT });

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });
});
