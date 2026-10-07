import { createHash } from 'crypto';
import {
  ConflictException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IncidentsService } from '../incidents/incidents.service';
import { PrismaService } from '../prisma.service';
import { ActionLinksService } from './action-links.service';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('../incidents/incidents.service', () => ({
  IncidentsService: class {},
}));

const token = (overrides: Record<string, unknown> = {}) => ({
  id: 'at1',
  action: 'ACKNOWLEDGE',
  userId: 'u1',
  usedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user: { id: 'u1', name: 'Priyanshu Maurya' },
  incident: {
    id: 'i1',
    number: 142,
    title: 'Pool exhausted',
    severity: 'CRITICAL',
    status: 'TRIGGERED',
    organizationId: 'o1',
    service: { name: 'Checkout API' },
  },
  ...overrides,
});

describe('ActionLinksService', () => {
  let service: ActionLinksService;
  let prisma: { actionToken: { findUnique: jest.Mock; update: jest.Mock } };
  let incidents: { acknowledge: jest.Mock; resolve: jest.Mock };

  beforeEach(async () => {
    prisma = {
      actionToken: {
        findUnique: jest.fn().mockResolvedValue(token()),
        update: jest.fn(),
      },
    };
    incidents = {
      acknowledge: jest
        .fn()
        .mockResolvedValue({ incident: { status: 'ACKNOWLEDGED' } }),
      resolve: jest
        .fn()
        .mockResolvedValue({ incident: { status: 'RESOLVED' } }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ActionLinksService,
        { provide: PrismaService, useValue: prisma },
        { provide: IncidentsService, useValue: incidents },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'https://app.vigil.app' },
        },
      ],
    }).compile();
    service = moduleRef.get(ActionLinksService);
  });

  it('looking at a link shows what it will do, and does not do it', async () => {
    const result = await service.getAction('raw-token');

    expect(result).toMatchObject({
      action: 'ACKNOWLEDGE',
      incident: {
        number: 142,
        title: 'Pool exhausted',
        severity: 'CRITICAL',
        status: 'TRIGGERED',
        service: 'Checkout API',
      },
      user: { name: 'Priyanshu Maurya' },
    });
    expect(prisma.actionToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken('raw-token') } }),
    );
    expect(incidents.acknowledge).not.toHaveBeenCalled();
    expect(prisma.actionToken.update).not.toHaveBeenCalled();
  });

  it('gives 404 for an unknown link and 410 for a used or expired one', async () => {
    prisma.actionToken.findUnique.mockResolvedValue(null);
    await expect(service.getAction('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.actionToken.findUnique.mockResolvedValue(
      token({ usedAt: new Date() }),
    );
    await expect(service.performAction('x')).rejects.toBeInstanceOf(
      GoneException,
    );

    prisma.actionToken.findUnique.mockResolvedValue(
      token({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(service.getAction('x')).rejects.toBeInstanceOf(GoneException);
    expect(incidents.acknowledge).not.toHaveBeenCalled();
  });

  it('acknowledges as the person the email was sent to, then uses up the link', async () => {
    const result = await service.performAction('raw-token');

    expect(incidents.acknowledge).toHaveBeenCalledWith('u1', 'o1', 'i1');
    expect(prisma.actionToken.update).toHaveBeenCalledWith({
      where: { id: 'at1' },
      data: { usedAt: expect.any(Date) as Date },
    });
    expect(result).toEqual({
      action: 'ACKNOWLEDGE',
      incident: { number: 142, status: 'ACKNOWLEDGED' },
      dashboardUrl: 'https://app.vigil.app/incidents/142',
    });
  });

  it('resolves with a resolve link', async () => {
    prisma.actionToken.findUnique.mockResolvedValue(
      token({ action: 'RESOLVE' }),
    );

    const result = await service.performAction('raw-token');

    expect(incidents.resolve).toHaveBeenCalledWith('u1', 'o1', 'i1', {});
    expect(result.incident.status).toBe('RESOLVED');
  });

  it('passes on the 409 when someone else got there first, and keeps the link', async () => {
    incidents.acknowledge.mockRejectedValue(
      new ConflictException({ code: 'ALREADY_ACKNOWLEDGED' }),
    );

    await expect(service.performAction('raw-token')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.actionToken.update).not.toHaveBeenCalled();
  });
});
