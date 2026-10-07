import { Test } from '@nestjs/testing';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { EscalationService } from '../escalation/escalation.service';
import { PrismaService } from '../prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AlertsService } from './alerts.service';

jest.mock('../realtime/realtime.service', () => ({
  RealtimeService: class {},
}));

jest.mock('../escalation/escalation.service', () => ({
  EscalationService: class {},
}));

function createPrismaMock() {
  const models = {
    $queryRaw: jest.fn(),
    alert: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        id: 'a1',
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
    $transaction: jest.fn((run: (tx: typeof models) => unknown) => run(models)),
  };
}

const KEY = { id: 'k1', serviceId: 's1', organizationId: 'o1' };
const OPEN = { id: 'i9', number: 141 };

describe('AlertsService', () => {
  let service: AlertsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let apiKeys: { markKeyUsed: jest.Mock };
  let escalation: { start: jest.Mock; cancel: jest.Mock };
  let realtime: { emitIncident: jest.Mock };

  const alertData = () =>
    (
      prisma.alert.create.mock.calls[0] as [{ data: Record<string, unknown> }]
    )[0].data;

  beforeEach(async () => {
    prisma = createPrismaMock();
    apiKeys = { markKeyUsed: jest.fn() };
    escalation = { start: jest.fn(), cancel: jest.fn() };
    realtime = { emitIncident: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ApiKeysService, useValue: apiKeys },
        { provide: EscalationService, useValue: escalation },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compile();
    service = moduleRef.get(AlertsService);
  });

  describe('a triggered alert with nothing open', () => {
    it('creates the next incident number, stores the alert and notifies', async () => {
      const dto = {
        title: 'Pool exhausted',
        dedup_key: 'db-pool',
        severity: 'critical' as const,
      };
      const payload = { ...dto, extra: 'kept' };

      const result = await service.createAlert(KEY, dto, payload);

      expect(result).toEqual({
        created: true,
        body: {
          alert_id: 'a1',
          incident_id: 'i1',
          incident_number: 142,
          deduplicated: false,
        },
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
      expect(alertData()).toMatchObject({
        payload,
        incidentId: 'i1',
        apiKeyId: 'k1',
        deduplicated: false,
      });
      await new Promise((resolve) => setImmediate(resolve));
      expect(escalation.start).toHaveBeenCalledWith('i1');
      expect(realtime.emitIncident).toHaveBeenCalledWith(
        'incident.created',
        'i1',
      );
      expect(apiKeys.markKeyUsed).toHaveBeenCalledWith('k1');
    });

    it('locks the service row before looking for an open incident', async () => {
      await service.createAlert(KEY, { title: 'A', dedup_key: 'k' }, {});

      expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.incident.findFirst.mock.invocationCallOrder[0],
      );
    });

    it('uses HIGH when no severity is sent, and never matches without a dedup key', async () => {
      const result = await service.createAlert(KEY, { title: 'A' }, {});

      expect(prisma.incident.findFirst).not.toHaveBeenCalled();
      expect(alertData().severity).toBe('HIGH');
      expect(result.created).toBe(true);
    });
  });

  describe('a triggered alert with the same dedup key as an open incident', () => {
    it('joins it instead of creating another, and does not notify again', async () => {
      prisma.incident.findFirst.mockResolvedValue(OPEN);

      const result = await service.createAlert(
        KEY,
        { title: 'Pool exhausted', dedup_key: 'db-pool' },
        {},
      );

      expect(result).toEqual({
        created: false,
        body: {
          alert_id: 'a1',
          incident_id: 'i9',
          incident_number: 141,
          deduplicated: true,
        },
      });
      expect(prisma.incident.findFirst).toHaveBeenCalledWith({
        where: {
          serviceId: 's1',
          dedupKey: 'db-pool',
          status: { not: 'RESOLVED' },
        },
      });
      expect(prisma.incident.create).not.toHaveBeenCalled();
      expect(escalation.start).not.toHaveBeenCalled();
      expect(realtime.emitIncident).toHaveBeenCalledWith(
        'incident.updated',
        'i9',
      );
    });
  });

  describe('a resolved alert', () => {
    it('closes the matching open incident', async () => {
      prisma.incident.findFirst.mockResolvedValue(OPEN);

      const result = await service.createAlert(
        KEY,
        { title: 'Recovered', dedup_key: 'db-pool', status: 'resolved' },
        {},
      );

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
      expect(escalation.cancel).toHaveBeenCalledWith('i9');
      expect(realtime.emitIncident).toHaveBeenCalledWith(
        'incident.resolved',
        'i9',
        null,
      );
    });

    it('is still stored, with no incident, when nothing is open', async () => {
      const result = await service.createAlert(
        KEY,
        { title: 'Recovered', dedup_key: 'db-pool', status: 'resolved' },
        {},
      );

      expect(result.body).toEqual({
        alert_id: 'a1',
        incident_id: null,
        incident_number: null,
        action: 'resolved',
      });
      expect(prisma.alert.create).toHaveBeenCalled();
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });
  });

  describe('Idempotency-Key', () => {
    it('answers a retry with the first result and stores nothing', async () => {
      prisma.alert.findFirst.mockResolvedValue({
        id: 'a0',
        status: 'TRIGGERED',
        deduplicated: false,
        incident: OPEN,
      });

      const result = await service.createAlert(
        KEY,
        { title: 'A' },
        {},
        'retry-1',
      );

      expect(result.body).toEqual({
        alert_id: 'a0',
        incident_id: 'i9',
        incident_number: 141,
        deduplicated: false,
      });
      expect(prisma.alert.create).not.toHaveBeenCalled();
      expect(escalation.start).not.toHaveBeenCalled();
    });

    it('is saved on the alert the first time', async () => {
      await service.createAlert(KEY, { title: 'A' }, {}, 'first-1');

      expect(alertData().idempotencyKey).toBe('first-1');
    });
  });
});
