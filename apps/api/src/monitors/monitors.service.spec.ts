import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { lookup } from 'dns/promises';
import { AlertsService } from '../alerts/alerts.service';
import { PrismaService } from '../prisma.service';
import { MONITORS_QUEUE, MonitorsService } from './monitors.service';

jest.mock('dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('../alerts/alerts.service', () => ({ AlertsService: class {} }));

const lookupMock = lookup as unknown as jest.Mock;

const monitor = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  name: 'Website',
  url: 'https://example.com/health',
  intervalMinutes: 1,
  status: 'UP' as 'PENDING' | 'UP' | 'DOWN',
  failCount: 0,
  lastCheckedAt: null as Date | null,
  organizationId: 'o1',
  serviceId: 's1',
  ...overrides,
});

describe('MonitorsService', () => {
  let service: MonitorsService;
  let prisma: {
    monitor: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    monitorCheck: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      deleteMany: jest.Mock;
    };
    service: { findFirst: jest.Mock };
  };
  let alerts: { createAlert: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    prisma = {
      monitor: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      monitorCheck: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn(),
      },
      service: { findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
    };
    alerts = { createAlert: jest.fn() };
    fetchMock = jest.fn().mockResolvedValue({ status: 200 });
    global.fetch = fetchMock;
    lookupMock.mockResolvedValue({ address: '93.184.216.34' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        MonitorsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AlertsService, useValue: alerts },
        {
          provide: getQueueToken(MONITORS_QUEUE),
          useValue: { upsertJobScheduler: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(MonitorsService);
  });

  it('records a good answer and raises nothing', async () => {
    await service.checkMonitor(monitor());

    expect(prisma.monitorCheck.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        monitorId: 'm1',
        up: true,
        statusCode: 200,
      }) as unknown,
    });
    expect(prisma.monitor.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: expect.objectContaining({ status: 'UP', failCount: 0 }) as unknown,
    });
    expect(alerts.createAlert).not.toHaveBeenCalled();
  });

  it('does not alert on the first failure', async () => {
    fetchMock.mockResolvedValue({ status: 503 });

    await service.checkMonitor(monitor());

    expect(prisma.monitor.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: expect.objectContaining({ status: 'UP', failCount: 1 }) as unknown,
    });
    expect(alerts.createAlert).not.toHaveBeenCalled();
  });

  it('marks it down and raises an alert on the second failure in a row', async () => {
    fetchMock.mockResolvedValue({ status: 503 });

    await service.checkMonitor(monitor({ failCount: 1 }));

    expect(prisma.monitor.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: expect.objectContaining({
        status: 'DOWN',
        failCount: 2,
      }) as unknown,
    });
    expect(alerts.createAlert).toHaveBeenCalledWith(
      { serviceId: 's1', organizationId: 'o1' },
      expect.objectContaining({
        title: 'Website is down',
        dedup_key: 'monitor-m1',
        status: 'triggered',
        description:
          'Uptime check for https://example.com/health: Answered with status 503',
      }),
      expect.anything(),
    );
  });

  it('does not alert again while it stays down', async () => {
    fetchMock.mockRejectedValue(new Error('connect refused'));

    await service.checkMonitor(monitor({ status: 'DOWN', failCount: 5 }));

    expect(alerts.createAlert).not.toHaveBeenCalled();
  });

  it('resolves the incident when the address answers again', async () => {
    await service.checkMonitor(monitor({ status: 'DOWN', failCount: 4 }));

    expect(prisma.monitor.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: expect.objectContaining({ status: 'UP', failCount: 0 }) as unknown,
    });
    expect(alerts.createAlert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dedup_key: 'monitor-m1', status: 'resolved' }),
      expect.anything(),
    );
  });

  it('counts a timeout as a failure and says so', async () => {
    const timeout = new Error('aborted');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeout);

    await service.checkMonitor(monitor());

    expect(prisma.monitorCheck.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        up: false,
        statusCode: null,
        error: 'No answer within 10 seconds',
      }) as unknown,
    });
  });

  it('refuses an address on a private network, without visiting it', async () => {
    for (const address of ['127.0.0.1', '10.0.0.5', '192.168.1.10', '::1']) {
      lookupMock.mockResolvedValue({ address });

      await expect(
        service.createMonitor('o1', {
          name: 'Inside',
          url: 'http://internal.example/admin',
          intervalMinutes: 1,
          serviceId: 's1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    expect(prisma.monitor.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only checks the monitors whose time has come', async () => {
    const now = Date.now();
    prisma.monitor.findMany.mockResolvedValue([
      monitor({ id: 'never-checked' }),
      monitor({ id: 'just-checked', lastCheckedAt: new Date(now - 20 * 1000) }),
      monitor({
        id: 'every-5-due',
        intervalMinutes: 5,
        lastCheckedAt: new Date(now - 6 * 60 * 1000),
      }),
      monitor({
        id: 'every-5-not-due',
        intervalMinutes: 5,
        lastCheckedAt: new Date(now - 2 * 60 * 1000),
      }),
    ]);

    await service.checkDueMonitors();

    const checked = (
      prisma.monitorCheck.create.mock.calls as [
        { data: { monitorId: string } },
      ][]
    ).map((call) => call[0].data.monitorId);
    expect(checked).toEqual(['never-checked', 'every-5-due']);
    expect(prisma.monitorCheck.deleteMany).toHaveBeenCalled();
  });

  it('visits its own address every minute when KEEP_AWAKE_URL is set', async () => {
    process.env.KEEP_AWAKE_URL = 'https://vigil-api.example.com/health';

    await service.checkDueMonitors();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://vigil-api.example.com/health',
      expect.anything(),
    );
    delete process.env.KEEP_AWAKE_URL;
  });

  it('visits nothing extra when KEEP_AWAKE_URL is not set', async () => {
    await service.checkDueMonitors();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
