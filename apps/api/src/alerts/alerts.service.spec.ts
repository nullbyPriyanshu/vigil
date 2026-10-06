import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { PrismaService } from '../prisma.service';
import { AlertsService } from './alerts.service';

function createPrismaMock() {
  const models = {
    $queryRaw: jest.fn(),
    alert: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        id: 'a1',
        receivedAt: new Date('2026-01-12'),
        ...data,
      })),
    },
    incident: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        id: 'i1',
        ...data,
      })),
      update: jest.fn(),
    },
    incidentEvent: { create: jest.fn() },
    organization: {
      update: jest.fn().mockResolvedValue({ id: 'o1', incidentCounter: 142 }),
    },
  };
  return {
    ...models,
    // Runs the callback straight away with the same mocks as the "tx".
    $transaction: jest.fn((run: (tx: typeof models) => unknown) => run(models)),
  };
}

const KEY = { id: 'k1', serviceId: 's1', organizationId: 'o1' };
const OPEN = { id: 'i9', number: 141 };

describe('AlertsService', () => {
  let service: AlertsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let apiKeys: { markKeyUsed: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    apiKeys = { markKeyUsed: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ApiKeysService, useValue: apiKeys },
      ],
    }).compile();
    service = moduleRef.get(AlertsService);
  });

  describe('a triggered alert with nothing open', () => {
    it('creates incident number counter+1, stores the alert and logs CREATED', async () => {
      const body = {
        title: 'Pool exhausted',
        dedup_key: 'db-pool',
        severity: 'critical',
        extra: 'kept',
      };

      const result = await service.ingestAlert(KEY, body);

      expect(result).toEqual({
        created: true,
        body: {
          alert_id: 'a1',
          incident_id: 'i1',
          incident_number: 142,
          deduplicated: false,
        },
      });
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { incidentCounter: { increment: 1 } },
      });
      expect(prisma.incident.create).toHaveBeenCalledWith({
        data: {
          number: 142,
          title: 'Pool exhausted',
          description: null,
          severity: 'CRITICAL',
          dedupKey: 'db-pool',
          organizationId: 'o1',
          serviceId: 's1',
        },
      });
      // The payload is the body exactly as sent, unknown fields and all.
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: body,
          incidentId: 'i1',
          apiKeyId: 'k1',
        }) as unknown,
      });
      expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'CREATED',
          actorType: 'INTEGRATION',
        }) as unknown,
      });
      expect(apiKeys.markKeyUsed).toHaveBeenCalledWith('k1');
    });

    it('locks the service row before looking for an open incident', async () => {
      await service.ingestAlert(KEY, { title: 'A', dedup_key: 'k' });

      expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.incident.findFirst.mock.invocationCallOrder[0],
      );
    });

    it('never matches an open incident when there is no dedup key', async () => {
      const result = await service.ingestAlert(KEY, { title: 'A' });

      expect(prisma.incident.findFirst).not.toHaveBeenCalled();
      expect(result.created).toBe(true);
    });
  });

  describe('a triggered alert with the same dedup key as an open incident', () => {
    beforeEach(() => prisma.incident.findFirst.mockResolvedValue(OPEN));

    it('joins it instead of creating another', async () => {
      const result = await service.ingestAlert(KEY, {
        title: 'Pool exhausted',
        dedup_key: 'db-pool',
      });

      expect(result).toEqual({
        created: false,
        body: {
          alert_id: 'a1',
          incident_id: 'i9',
          incident_number: 141,
          deduplicated: true,
        },
      });
      expect(prisma.incident.create).not.toHaveBeenCalled();
      expect(prisma.organization.update).not.toHaveBeenCalled();
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          incidentId: 'i9',
          deduplicated: true,
        }) as unknown,
      });
    });

    it('only looks at open incidents of this service', async () => {
      await service.ingestAlert(KEY, { title: 'A', dedup_key: 'db-pool' });

      expect(prisma.incident.findFirst).toHaveBeenCalledWith({
        where: {
          serviceId: 's1',
          dedupKey: 'db-pool',
          status: { not: 'RESOLVED' },
        },
      });
    });
  });

  describe('a resolved alert', () => {
    it('closes the matching open incident', async () => {
      prisma.incident.findFirst.mockResolvedValue(OPEN);

      const result = await service.ingestAlert(KEY, {
        title: 'Recovered',
        dedup_key: 'db-pool',
        status: 'resolved',
      });

      expect(result).toEqual({
        created: false,
        body: {
          alert_id: 'a1',
          incident_id: 'i9',
          incident_number: 141,
          action: 'resolved',
        },
      });
      const update = prisma.incident.update.mock.calls[0] as [
        { where: unknown; data: { status: string } },
      ];
      expect(update[0].where).toEqual({ id: 'i9' });
      expect(update[0].data.status).toBe('RESOLVED');
      expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'RESOLVED',
          actorType: 'INTEGRATION',
        }) as unknown,
      });
    });

    it('is still stored, with a null incident, when nothing is open', async () => {
      const result = await service.ingestAlert(KEY, {
        title: 'Recovered',
        dedup_key: 'db-pool',
        status: 'resolved',
      });

      expect(result.body).toEqual({
        alert_id: 'a1',
        incident_id: null,
        incident_number: null,
        action: 'resolved',
      });
      expect(prisma.alert.create).toHaveBeenCalled();
      expect(prisma.incident.update).not.toHaveBeenCalled();
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });
  });

  describe('Idempotency-Key', () => {
    it('answers a retry with the first result and stores nothing', async () => {
      prisma.alert.findUnique.mockResolvedValue({
        id: 'a0',
        incidentId: 'i9',
        status: 'TRIGGERED',
        deduplicated: false,
        incident: { number: 141 },
      });

      const result = await service.ingestAlert(KEY, { title: 'A' }, 'retry-1');

      expect(result).toEqual({
        created: false,
        body: {
          alert_id: 'a0',
          incident_id: 'i9',
          incident_number: 141,
          deduplicated: false,
        },
      });
      expect(prisma.alert.findUnique).toHaveBeenCalledWith({
        where: {
          serviceId_idempotencyKey: {
            serviceId: 's1',
            idempotencyKey: 'retry-1',
          },
        },
        include: { incident: true },
      });
      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it('is saved on the alert the first time', async () => {
      await service.ingestAlert(KEY, { title: 'A' }, 'first-1');

      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ idempotencyKey: 'first-1' }) as unknown,
      });
    });
  });

  describe('bad input', () => {
    it('rejects a body with no title before touching the database', async () => {
      await expect(service.ingestAlert(KEY, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('ingestFromSource', () => {
    it('rejects a source it has no translator for', async () => {
      await expect(
        service.ingestFromSource(KEY, 'pagerduty', {}),
      ).rejects.toThrow(
        'Unsupported source "pagerduty". Use one of: sentry, grafana, uptimerobot',
      );
    });

    it('rejects a payload the translator cannot read', async () => {
      await expect(
        service.ingestFromSource(KEY, 'sentry', { hello: 'world' }),
      ).rejects.toThrow("This doesn't look like a sentry webhook payload");
    });

    it('runs a translated webhook through the same pipeline, keeping the original body', async () => {
      const body = {
        monitorID: 77,
        monitorFriendlyName: 'Website',
        alertType: 1,
      };

      const result = await service.ingestFromSource(KEY, 'UptimeRobot', body);

      expect(result.created).toBe(true);
      expect(prisma.incident.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Website is down',
          dedupKey: 'uptimerobot-77',
          severity: 'CRITICAL',
        }) as unknown,
      });
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ payload: body }) as unknown,
      });
    });
  });
});
