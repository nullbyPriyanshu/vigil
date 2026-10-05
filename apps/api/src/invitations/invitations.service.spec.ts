import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import { hashToken } from '../auth/utils/tokens';
import { MailService } from '../mail/mail.service';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma.service';
import { InvitationsService } from './invitations.service';

// These two pull in ES-module-only packages Jest can't load; the tests use
// fakes for them anyway.
jest.mock('../mail/mail.service', () => ({ MailService: class {} }));
jest.mock('../auth/auth.service', () => ({ AuthService: class {} }));

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

const ORG = { id: 'o1', name: 'Acme Corp', slug: 'acme-corp' };

function createPrismaMock() {
  const models = {
    organization: { findUnique: jest.fn().mockResolvedValue(ORG) },
    user: { findUnique: jest.fn(), create: jest.fn() },
    membership: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
    },
    invitation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  return {
    ...models,
    // Supports both styles: a list of queries, or a function given `tx`.
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof models) => unknown)(models)
        : Promise.all(arg as unknown[]),
    ),
  };
}

describe('InvitationsService', () => {
  let service: InvitationsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let mail: { sendInvitationEmail: jest.Mock };
  let members: { assertCanManageMembers: jest.Mock };
  let auth: { issueTokens: jest.Mock };

  const invitation = (overrides: Record<string, unknown> = {}) => ({
    id: 'i1',
    email: 'amit@acme.com',
    role: 'RESPONDER',
    expiresAt: future(),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    organization: ORG,
    invitedBy: { id: 'u1', name: 'Priyanshu Maurya' },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    mail = { sendInvitationEmail: jest.fn() };
    members = { assertCanManageMembers: jest.fn() };
    auth = {
      issueTokens: jest
        .fn()
        .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: MembersService, useValue: members },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();
    service = moduleRef.get(InvitationsService);
  });

  describe('createInvitation', () => {
    const dto = { email: 'amit@acme.com', role: 'RESPONDER' as const };

    it('does nothing when the person is already a member', async () => {
      prisma.membership.findFirst.mockResolvedValue({ id: 'm1' });

      await expect(service.createInvitation('u1', 'o1', dto)).resolves.toEqual({
        alreadyMember: true,
      });
      expect(prisma.invitation.create).not.toHaveBeenCalled();
      expect(mail.sendInvitationEmail).not.toHaveBeenCalled();
    });

    it('replaces older invitations, stores only a hash, and emails the link', async () => {
      prisma.membership.findFirst.mockResolvedValue(null);
      prisma.invitation.create.mockResolvedValue(invitation());

      const result = await service.createInvitation('u1', 'o1', dto);

      expect(prisma.invitation.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: 'o1', email: dto.email, acceptedAt: null },
      });

      const sent = mail.sendInvitationEmail.mock.calls[0] as [
        string,
        { token: string; expiresInDays: number },
      ];
      const saved = prisma.invitation.create.mock.calls[0] as [
        { data: { tokenHash: string } },
      ];
      expect(sent[0]).toBe('amit@acme.com');
      expect(sent[1].expiresInDays).toBe(7);
      expect(sent[1].token).toHaveLength(64); // 32 random bytes as hex
      expect(saved[0].data.tokenHash).toBe(hashToken(sent[1].token));
      expect(saved[0].data.tokenHash).not.toBe(sent[1].token);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'i1',
          email: 'amit@acme.com',
          role: 'RESPONDER',
          invitedBy: { id: 'u1', name: 'Priyanshu Maurya' },
        }),
      );
      expect(result).not.toHaveProperty('tokenHash');
    });

    it('removes the invitation again if the email cannot be sent', async () => {
      prisma.membership.findFirst.mockResolvedValue(null);
      prisma.invitation.create.mockResolvedValue(invitation());
      mail.sendInvitationEmail.mockRejectedValue(new Error('down'));
      jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await expect(
        service.createInvitation('u1', 'o1', dto),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(prisma.invitation.delete).toHaveBeenCalledWith({
        where: { id: 'i1' },
      });
    });

    it('is refused for someone who cannot manage members', async () => {
      members.assertCanManageMembers.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.createInvitation('u9', 'o1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.invitation.create).not.toHaveBeenCalled();
    });
  });

  describe('listInvitations', () => {
    it('asks only for pending invitations, newest first', async () => {
      prisma.invitation.findMany.mockResolvedValue([invitation()]);

      const { data } = await service.listInvitations('u1', 'o1');

      const query = prisma.invitation.findMany.mock.calls[0] as [
        { where: Record<string, unknown>; orderBy: unknown },
      ];
      expect(query[0].where).toMatchObject({
        organizationId: 'o1',
        acceptedAt: null,
        revokedAt: null,
      });
      expect(query[0].where).toHaveProperty('expiresAt');
      expect(query[0].orderBy).toEqual({ createdAt: 'desc' });
      expect(data).toHaveLength(1);
    });
  });

  describe('revokeInvitation', () => {
    it('throws 404 for an invitation outside this organization', async () => {
      prisma.invitation.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeInvitation('u1', 'o1', 'i-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marks the invitation revoked', async () => {
      prisma.invitation.findFirst.mockResolvedValue(invitation());

      await service.revokeInvitation('u1', 'o1', 'i1');

      const update = prisma.invitation.update.mock.calls[0] as [
        { where: { id: string }; data: { revokedAt: Date } },
      ];
      expect(update[0].where).toEqual({ id: 'i1' });
      expect(update[0].data.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('previewInvitation', () => {
    it('throws 404 for an unknown token', async () => {
      prisma.invitation.findUnique.mockResolvedValue(null);

      await expect(service.previewInvitation('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it.each([
      ['expired', { expiresAt: past() }],
      ['revoked', { revokedAt: new Date() }],
      ['already accepted', { acceptedAt: new Date() }],
    ])('throws 410 when the invitation is %s', async (_label, overrides) => {
      prisma.invitation.findUnique.mockResolvedValue(invitation(overrides));

      await expect(service.previewInvitation('t')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('returns only what the invite page needs', async () => {
      prisma.invitation.findUnique.mockResolvedValue(invitation());
      prisma.user.findUnique.mockResolvedValue(null);

      const preview = await service.previewInvitation('t');

      expect(Object.keys(preview).sort()).toEqual(
        ['email', 'expiresAt', 'hasAccount', 'organization', 'role'].sort(),
      );
      expect(preview.organization).toEqual({ name: 'Acme Corp' });
      expect(preview.hasAccount).toBe(false);
    });
  });

  describe('acceptInvitation', () => {
    beforeEach(() => {
      prisma.invitation.findUnique.mockResolvedValue(invitation());
      prisma.membership.findUniqueOrThrow.mockResolvedValue({
        organizationId: 'o1',
        role: 'RESPONDER',
      });
    });

    describe('with no account yet', () => {
      beforeEach(() => {
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue({ id: 'new-user' });
      });

      it('needs a name and password', async () => {
        await expect(
          service.acceptInvitation('t', {}, undefined),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.user.create).not.toHaveBeenCalled();
      });

      it('creates the user and membership and logs them in', async () => {
        const result = await service.acceptInvitation(
          't',
          { name: 'Amit Sharma', password: 'Str0ng!Pass' },
          undefined,
        );

        const created = prisma.user.create.mock.calls[0] as [
          { data: { email: string; passwordHash: string } },
        ];
        // The email comes from the invitation, never from the request.
        expect(created[0].data.email).toBe('amit@acme.com');
        expect(created[0].data.passwordHash).not.toBe('Str0ng!Pass');
        expect(prisma.membership.create).toHaveBeenCalledWith({
          data: { userId: 'new-user', organizationId: 'o1', role: 'RESPONDER' },
        });
        expect(auth.issueTokens).toHaveBeenCalledWith('new-user', {
          organizationId: 'o1',
          role: 'RESPONDER',
        });
        expect(result).toEqual({
          accessToken: 'access',
          refreshToken: 'refresh',
          organization: ORG,
          role: 'RESPONDER',
        });
      });

      it('gives 410 if someone else used the link a moment earlier', async () => {
        prisma.invitation.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          service.acceptInvitation(
            't',
            { name: 'Amit Sharma', password: 'Str0ng!Pass' },
            undefined,
          ),
        ).rejects.toBeInstanceOf(GoneException);
        expect(auth.issueTokens).not.toHaveBeenCalled();
      });
    });

    describe('with an existing account', () => {
      let account: { id: string; passwordHash: string };

      beforeAll(async () => {
        account = {
          id: 'amit',
          passwordHash: await bcrypt.hash('Str0ng!Pass', 4),
        };
      });
      beforeEach(() => prisma.user.findUnique.mockResolvedValue(account));

      it('gives 401 when not logged in and no password is sent', async () => {
        await expect(
          service.acceptInvitation('t', {}, undefined),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });

      it('gives 403 when logged in as somebody else', async () => {
        await expect(
          service.acceptInvitation(
            't',
            {},
            { userId: 'someone-else', organizationId: 'o9', role: 'OWNER' },
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.membership.upsert).not.toHaveBeenCalled();
      });

      it('adds the membership when logged in as that account', async () => {
        await service.acceptInvitation(
          't',
          {},
          { userId: 'amit', organizationId: 'o9', role: 'VIEWER' },
        );

        expect(prisma.user.create).not.toHaveBeenCalled();
        expect(prisma.membership.upsert).toHaveBeenCalledTimes(1);
        expect(auth.issueTokens).toHaveBeenCalledWith('amit', {
          organizationId: 'o1',
          role: 'RESPONDER',
        });
      });

      it('accepts the right password in place of being logged in', async () => {
        await service.acceptInvitation(
          't',
          { currentPassword: 'Str0ng!Pass' },
          undefined,
        );

        expect(prisma.membership.upsert).toHaveBeenCalledTimes(1);
      });

      it('rejects a wrong password', async () => {
        await expect(
          service.acceptInvitation(
            't',
            { currentPassword: 'wrong' },
            undefined,
          ),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(prisma.membership.upsert).not.toHaveBeenCalled();
      });
    });
  });
});
