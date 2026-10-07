import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { AnalyticsService } from './analytics.service';

const at = (iso: string) => new Date(iso);

const row = (overrides: Record<string, unknown>) => ({
  serviceId: 's1',
  severity: 'HIGH',
  currentStepPosition: 1,
  escalationRound: 0,
  acknowledgedAt: null,
  resolvedAt: null,
  ...overrides,
});

const INCIDENTS = [
  row({
    createdAt: at('2026-01-10T05:00:00Z'),
    acknowledgedAt: at('2026-01-10T05:02:00Z'),
    resolvedAt: at('2026-01-10T05:30:00Z'),
    severity: 'CRITICAL',
  }),
  row({
    createdAt: at('2026-01-11T20:00:00Z'),
    acknowledgedAt: at('2026-01-11T20:06:00Z'),
    resolvedAt: at('2026-01-11T20:50:00Z'),
    currentStepPosition: 2,
  }),
  row({
    createdAt: at('2026-01-12T03:00:00Z'),
    serviceId: 's2',
    severity: 'LOW',
  }),
  row({
    createdAt: at('2026-01-12T04:00:00Z'),
    serviceId: 's2',
    escalationRound: 1,
  }),
];

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    incident: { findMany: jest.Mock; count: jest.Mock };
    service: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(at('2026-01-12T06:00:00Z'));
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }),
      },
      incident: {
        findMany: jest.fn().mockResolvedValue(INCIDENTS),
        count: jest.fn(({ where }: { where: { status: string } }) =>
          where.status === 'TRIGGERED' ? 2 : 1,
        ),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's1', name: 'Checkout API' },
          { id: 's2', name: 'Auth Service' },
          { id: 's3', name: 'Quiet Service' },
        ]),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AnalyticsService);
  });

  afterEach(() => jest.useRealTimers());

  it('summarises open counts, MTTA, MTTR, escalation rate and severity', async () => {
    const summary = await service.getSummary('u1', 'o1', 7);

    expect(summary).toMatchObject({
      days: 7,
      openTriggered: 2,
      openAcknowledged: 1,
      totalIncidents: 4,
      mttaSeconds: 240,
      mttrSeconds: 2400,
      escalationRate: 0.5,
      bySeverity: { CRITICAL: 1, HIGH: 2, LOW: 1 },
    });
  });

  it('counts the incidents of the period just before this one', async () => {
    prisma.incident.count.mockImplementation(
      ({ where }: { where: { status?: string } }) => (where.status ? 0 : 9),
    );

    const summary = await service.getSummary('u1', 'o1', 7);

    expect(summary.previousTotalIncidents).toBe(9);
    expect(prisma.incident.count).toHaveBeenCalledWith({
      where: {
        organizationId: 'o1',
        createdAt: {
          gte: at('2025-12-29T18:30:00Z'),
          lt: at('2026-01-05T18:30:00Z'),
        },
      },
    });
  });

  it("fills in every day, bucketed in the caller's timezone", async () => {
    const summary = await service.getSummary('u1', 'o1', 7);

    expect(summary.incidentsByDay).toEqual([
      { date: '2026-01-06', count: 0 },
      { date: '2026-01-07', count: 0 },
      { date: '2026-01-08', count: 0 },
      { date: '2026-01-09', count: 0 },
      { date: '2026-01-10', count: 1 },
      { date: '2026-01-11', count: 0 },
      { date: '2026-01-12', count: 3 },
    ]);
  });

  it('asks only for incidents since the start of the first day, in this organization', async () => {
    await service.getIncidentsOverTime('u1', 'o1', 30);

    const query = (
      prisma.incident.findMany.mock.calls[0] as [{ where: unknown }]
    )[0];
    expect(query.where).toEqual({
      organizationId: 'o1',
      createdAt: { gte: at('2025-12-13T18:30:00.000Z') },
    });
  });

  it('returns null times when nothing was acknowledged or resolved', async () => {
    prisma.incident.findMany.mockResolvedValue([
      row({ createdAt: at('2026-01-12T03:00:00Z') }),
    ]);

    const summary = await service.getSummary('u1', 'o1', 7);

    expect(summary.mttaSeconds).toBeNull();
    expect(summary.mttrSeconds).toBeNull();
    expect(summary.escalationRate).toBe(0);
  });

  it('breaks incidents down by service, noisiest first, keeping quiet ones', async () => {
    const result = await service.getByService('u1', 'o1', 30);

    expect(result.data).toEqual([
      {
        service: { id: 's1', name: 'Checkout API' },
        count: 2,
        mttaSeconds: 240,
        mttrSeconds: 2400,
      },
      {
        service: { id: 's2', name: 'Auth Service' },
        count: 2,
        mttaSeconds: null,
        mttrSeconds: null,
      },
      {
        service: { id: 's3', name: 'Quiet Service' },
        count: 0,
        mttaSeconds: null,
        mttrSeconds: null,
      },
    ]);
  });
});
