import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { EscalationProcessor } from './escalation.processor';
import { ESCALATION_QUEUE, EscalationService } from './escalation.service';

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class {},
}));
jest.mock('../realtime/realtime.service', () => ({
  RealtimeService: class {},
}));

const NOW = new Date('2026-01-12T10:00:00.000Z');

const incident = (overrides: Record<string, unknown> = {}) => ({
  id: 'i1',
  status: 'TRIGGERED',
  currentStepPosition: 0,
  escalationRound: 0,
  lastAlertAt: new Date('2026-01-12T09:00:00.000Z'),
  service: {
    autoResolveMinutes: 30,
    escalationPolicy: {
      repeatCount: 1,
      steps: [
        { position: 1, delayMinutes: 5 },
        { position: 2, delayMinutes: 10 },
      ],
    },
  },
  ...overrides,
});

describe('EscalationProcessor', () => {
  let processor: EscalationProcessor;
  let escalation: EscalationService;
  let queue: {
    add: jest.Mock;
    getJob: jest.Mock;
    upsertJobScheduler: jest.Mock;
  };
  let prisma: {
    incident: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    incidentEvent: { create: jest.Mock };
  };
  let notifications: { notifyStep: jest.Mock };
  let realtime: { emitIncident: jest.Mock };

  const lastMessage = () =>
    (
      prisma.incidentEvent.create.mock.calls[0] as [
        { data: { message: string } },
      ]
    )[0].data.message;

  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(NOW);
    queue = {
      add: jest.fn(),
      getJob: jest.fn(),
      upsertJobScheduler: jest.fn(),
    };
    prisma = {
      incident: {
        findUnique: jest.fn().mockResolvedValue(incident()),
        findMany: jest.fn().mockResolvedValue([incident()]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      incidentEvent: { create: jest.fn() },
    };
    notifications = { notifyStep: jest.fn() };
    realtime = { emitIncident: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EscalationProcessor,
        EscalationService,
        { provide: getQueueToken(ESCALATION_QUEUE), useValue: queue },
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compile();
    processor = moduleRef.get(EscalationProcessor);
    escalation = moduleRef.get(EscalationService);
  });

  afterEach(() => jest.useRealTimers());

  describe('starting and cancelling', () => {
    it('starts by queueing step 1 with an id that can be worked out again later', async () => {
      await escalation.start('i1');

      expect(queue.add).toHaveBeenCalledWith(
        'step',
        { incidentId: 'i1', stepPosition: 1, round: 0 },
        expect.objectContaining({ jobId: 'esc-i1-1-0' }),
      );
    });

    it('cancels whichever job is waiting, and survives one that is already gone', async () => {
      prisma.incident.findUnique.mockResolvedValue(
        incident({ currentStepPosition: 1 }),
      );
      const remove = jest.fn();
      queue.getJob.mockImplementation((id: string) =>
        id === 'esc-i1-2-0' ? { remove } : null,
      );

      await escalation.cancel('i1');

      expect(queue.getJob.mock.calls.map((call: string[]) => call[0])).toEqual([
        'esc-i1-2-0',
        'esc-i1-1-1',
        'esc-i1-finish',
      ]);
      expect(remove).toHaveBeenCalledTimes(1);
    });

    it('registers the auto-resolve check once, under a fixed id', async () => {
      await escalation.onModuleInit();

      expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
        'auto-resolve',
        { every: 60000 },
        { name: 'auto-resolve' },
      );
    });
  });

  describe('running a step', () => {
    it('notifies step 1 and queues step 2 after its wait', async () => {
      await processor.runStep({ incidentId: 'i1', stepPosition: 1, round: 0 });

      expect(notifications.notifyStep).toHaveBeenCalledWith('i1', 1);
      expect(queue.add).toHaveBeenCalledWith(
        'step',
        { incidentId: 'i1', stepPosition: 2, round: 0 },
        expect.objectContaining({ delay: 5 * 60 * 1000, jobId: 'esc-i1-2-0' }),
      );
      expect(prisma.incident.updateMany).toHaveBeenLastCalledWith({
        where: { id: 'i1', status: 'TRIGGERED' },
        data: { nextEscalationAt: new Date('2026-01-12T10:05:00.000Z') },
      });
      expect(prisma.incidentEvent.create).not.toHaveBeenCalled();
    });

    it('guard 1: does nothing when someone acknowledged while it waited', async () => {
      prisma.incident.findUnique.mockResolvedValue(
        incident({ status: 'ACKNOWLEDGED' }),
      );

      await processor.runStep({ incidentId: 'i1', stepPosition: 2, round: 0 });

      expect(notifications.notifyStep).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('guard 2: does nothing when the same job is delivered twice', async () => {
      prisma.incident.findUnique.mockResolvedValue(
        incident({ currentStepPosition: 2 }),
      );

      await processor.runStep({ incidentId: 'i1', stepPosition: 2, round: 0 });
      await processor.runStep({ incidentId: 'i1', stepPosition: 1, round: 0 });

      expect(notifications.notifyStep).not.toHaveBeenCalled();
    });

    it('logs the escalation and, after the last step, queues round 2 from step 1', async () => {
      prisma.incident.findUnique.mockResolvedValue(
        incident({ currentStepPosition: 1 }),
      );

      await processor.runStep({ incidentId: 'i1', stepPosition: 2, round: 0 });

      expect(lastMessage()).toBe('Nobody responded. Escalated to step 2');
      expect(queue.add).toHaveBeenCalledWith(
        'step',
        { incidentId: 'i1', stepPosition: 1, round: 1 },
        expect.objectContaining({ delay: 10 * 60 * 1000, jobId: 'esc-i1-1-1' }),
      );
    });

    it('queues the finish job after the last step of the last round', async () => {
      prisma.incident.findUnique.mockResolvedValue(
        incident({ currentStepPosition: 1, escalationRound: 1 }),
      );

      await processor.runStep({ incidentId: 'i1', stepPosition: 2, round: 1 });

      expect(queue.add).toHaveBeenCalledWith(
        'finish',
        { incidentId: 'i1' },
        expect.objectContaining({ jobId: 'esc-i1-finish' }),
      );
    });

    it('finishing says nobody responded and clears the countdown', async () => {
      await processor.finishEscalation('i1');

      expect(prisma.incident.updateMany).toHaveBeenCalledWith({
        where: { id: 'i1', status: 'TRIGGERED' },
        data: { nextEscalationAt: null },
      });
      expect(lastMessage()).toBe(
        'Escalation policy finished and nobody responded',
      );
    });
  });

  describe('auto-resolve', () => {
    it('resolves an incident that has been quiet for longer than its service allows', async () => {
      await processor.autoResolveQuietIncidents();

      const update = (
        prisma.incident.updateMany.mock.calls[0] as [
          { where: Record<string, unknown>; data: Record<string, unknown> },
        ]
      )[0];
      expect(update.where.id).toBe('i1');
      expect(update.where.status).toEqual({ not: 'RESOLVED' });
      expect(update.data.status).toBe('RESOLVED');
      expect(lastMessage()).toBe(
        'No alerts for 30 minutes. Resolved automatically',
      );
      expect(realtime.emitIncident).toHaveBeenCalledWith(
        'incident.resolved',
        'i1',
        null,
      );
    });

    it('leaves an incident alone while alerts are still arriving', async () => {
      prisma.incident.findMany.mockResolvedValue([
        incident({ lastAlertAt: new Date('2026-01-12T09:45:00.000Z') }),
      ]);

      await processor.autoResolveQuietIncidents();

      expect(prisma.incident.updateMany).not.toHaveBeenCalled();
    });

    it('only looks at open incidents whose service has auto-resolve set', async () => {
      await processor.autoResolveQuietIncidents();

      const query = (
        prisma.incident.findMany.mock.calls[0] as [{ where: unknown }]
      )[0];
      expect(query.where).toEqual({
        status: { not: 'RESOLVED' },
        service: { autoResolveMinutes: { not: null } },
      });
    });
  });
});
