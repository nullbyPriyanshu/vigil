import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma.service';
import { AuthService } from './auth.service';
import { hashToken } from './utils/tokens';

// @nestjs/jwt v12 and @nestjs/config v12 are published as ES modules, which
// Jest (CommonJS) can't load. We don't need the real ones here, so swap in
// tiny fakes.
jest.mock('../mail/mail.service', () => ({ MailService: class {} }));
jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    signAsync(payload: object) {
      return Promise.resolve(`fake-jwt.${JSON.stringify(payload)}`);
    }
  },
}));

// These tests use fake ("mock") versions of Prisma, JWT and Mail, so they run
// without a database and never send real emails.

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

function createPrismaMock() {
  return {
    user: { findUnique: jest.fn(), update: jest.fn() },
    organization: { findUnique: jest.fn() },
    membership: { findFirst: jest.fn(), findUnique: jest.fn() },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn<
        unknown,
        [{ data: { tokenHash: string; organizationId?: string } }]
      >(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : arg,
    ),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let mail: {
    sendForgotPasswordEmail: jest.Mock;
    sendPasswordResetSuccessEmail: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    mail = {
      sendForgotPasswordEmail: jest.fn(),
      sendPasswordResetSuccessEmail: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        JwtService,
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('signup', () => {
    it('rejects an organization name with no letters or numbers', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.signup({
          name: 'Test',
          email: 'a@b.com',
          password: 'Str0ng!Pass',
          organizationName: '!!!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an email that is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

      await expect(
        service.signup({
          name: 'Test',
          email: 'a@b.com',
          password: 'Str0ng!Pass',
          organizationName: 'Acme',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    const password = 'Str0ng!Pass';
    let user: Record<string, unknown>;

    beforeAll(async () => {
      user = {
        id: 'u1',
        name: 'Test',
        email: 'a@b.com',
        timezone: 'Asia/Kolkata',
        passwordHash: await bcrypt.hash(password, 4),
        memberships: [{ organizationId: 'o1', role: 'OWNER' }],
      };
    });

    it('returns different access and refresh tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.login({ email: 'a@b.com', password });

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.accessToken).not.toEqual(result.refreshToken);
    });

    it('stores only the hash of the refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      const { refreshToken } = await service.login({
        email: 'a@b.com',
        password,
      });

      const saved = prisma.refreshToken.create.mock.calls[0][0];
      expect(saved.data.tokenHash).toBe(hashToken(refreshToken));
      expect(saved.data.tokenHash).not.toBe(refreshToken);
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@b.com', password }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rejects a request with no refresh token (never touches the DB)', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an unknown refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('nope')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        expiresAt: past(),
      });

      await expect(service.refresh('old')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token that another request already used', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        expiresAt: future(),
      });
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.refresh('raced')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rotates: deletes the old token and saves a new one', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        expiresAt: future(),
      });
      prisma.membership.findFirst.mockResolvedValue({
        organizationId: 'o1',
        role: 'OWNER',
      });

      const tokens = await service.refresh('valid');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { id: 'r1' },
      });
      const saved = prisma.refreshToken.create.mock.calls[0][0];
      expect(saved.data.tokenHash).toBe(hashToken(tokens.refreshToken));
      expect(tokens.refreshToken).not.toEqual('valid');
    });

    it('keeps the session in the organization it was started for', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        organizationId: 'o2',
        expiresAt: future(),
      });
      prisma.membership.findUnique.mockResolvedValue({
        organizationId: 'o2',
        role: 'RESPONDER',
      });

      await service.refresh('valid');

      expect(prisma.membership.findFirst).not.toHaveBeenCalled();
      const saved = prisma.refreshToken.create.mock.calls[0][0];
      expect(saved.data.organizationId).toBe('o2');
    });

    it('falls back to the first organization if they left that one', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        organizationId: 'o2',
        expiresAt: future(),
      });
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.membership.findFirst.mockResolvedValue({
        organizationId: 'o1',
        role: 'OWNER',
      });

      await service.refresh('valid');

      const saved = prisma.refreshToken.create.mock.calls[0][0];
      expect(saved.data.organizationId).toBe('o1');
    });
  });

  describe('forgotPassword', () => {
    it('gives the same answer whether or not the email exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const unknown = await service.forgotPassword('nobody@b.com');

      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@b.com',
        name: 'Test',
      });
      const known = await service.forgotPassword('a@b.com');

      expect(known).toEqual(unknown);
    });

    it('does not fail (or leak) when the email provider is down', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'Test',
      });
      mail.sendForgotPasswordEmail.mockRejectedValue(new Error('down'));
      jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await expect(service.forgotPassword('a@b.com')).resolves.toHaveProperty(
        'message',
      );
    });
  });

  describe('resetPassword', () => {
    it('rejects an expired link and deletes it', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'p1',
        expiresAt: past(),
      });

      await expect(
        service.resetPassword({ token: 't', password: 'N3w!Password' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
    });

    it('updates the password and logs out every session', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'p1',
        expiresAt: future(),
        user: { id: 'u1', email: 'a@b.com', name: 'Test' },
      });

      await service.resetPassword({ token: 't', password: 'N3w!Password' });

      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
    });
  });
});
