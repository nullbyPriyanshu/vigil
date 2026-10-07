import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma.service';
import { RealtimeService } from 'src/realtime/realtime.service';
import {
  ESCALATION_QUEUE,
  getFinishJobId,
  getStepJobId,
  StepJob,
} from './escalation.service';

@Processor(ESCALATION_QUEUE)
export class EscalationProcessor extends WorkerHost {
  constructor(
    @InjectQueue(ESCALATION_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name === 'auto-resolve') {
      await this.autoResolveQuietIncidents();
    } else if (job.name === 'finish') {
      await this.finishEscalation((job.data as StepJob).incidentId);
    } else {
      await this.runStep(job.data as StepJob);
    }
  }

  async runStep(job: StepJob) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: job.incidentId },
      include: {
        service: {
          include: { escalationPolicy: { include: { steps: true } } },
        },
      },
    });

    if (!incident || incident.status !== 'TRIGGERED') {
      return;
    }

    const alreadyRan =
      job.round < incident.escalationRound ||
      (job.round === incident.escalationRound &&
        job.stepPosition <= incident.currentStepPosition);
    if (alreadyRan) {
      return;
    }

    const policy = incident.service.escalationPolicy;
    const step = policy.steps.find((s) => s.position === job.stepPosition);
    if (!step) {
      return;
    }

    const updated = await this.prisma.incident.updateMany({
      where: { id: incident.id, status: 'TRIGGERED' },
      data: {
        currentStepPosition: job.stepPosition,
        escalationRound: job.round,
      },
    });
    if (updated.count === 0) {
      return;
    }

    const isFirstStep = job.stepPosition === 1 && job.round === 0;
    if (!isFirstStep) {
      await this.prisma.incidentEvent.create({
        data: {
          incidentId: incident.id,
          type: 'ESCALATED',
          actorType: 'SYSTEM',
          message:
            job.stepPosition === 1
              ? 'Nobody responded. Starting again from step 1'
              : `Nobody responded. Escalated to step ${job.stepPosition}`,
        },
      });
    }

    await this.notificationsService.notifyStep(incident.id, job.stepPosition);

    const delay = step.delayMinutes * 60 * 1000;
    const options = { delay, removeOnComplete: true, removeOnFail: true };

    if (job.stepPosition < policy.steps.length) {
      const next = {
        incidentId: incident.id,
        stepPosition: job.stepPosition + 1,
        round: job.round,
      };
      await this.queue.add('step', next, {
        ...options,
        jobId: getStepJobId(next),
      });
    } else if (job.round < policy.repeatCount) {
      const next = {
        incidentId: incident.id,
        stepPosition: 1,
        round: job.round + 1,
      };
      await this.queue.add('step', next, {
        ...options,
        jobId: getStepJobId(next),
      });
    } else {
      await this.queue.add(
        'finish',
        { incidentId: incident.id },
        { ...options, jobId: getFinishJobId(incident.id) },
      );
    }

    await this.prisma.incident.updateMany({
      where: { id: incident.id, status: 'TRIGGERED' },
      data: { nextEscalationAt: new Date(Date.now() + delay) },
    });

    await this.realtimeService.emitIncident('incident.updated', incident.id);
  }

  async finishEscalation(incidentId: string) {
    const updated = await this.prisma.incident.updateMany({
      where: { id: incidentId, status: 'TRIGGERED' },
      data: { nextEscalationAt: null },
    });
    if (updated.count === 0) {
      return;
    }

    await this.prisma.incidentEvent.create({
      data: {
        incidentId,
        type: 'ESCALATED',
        actorType: 'SYSTEM',
        message: 'Escalation policy finished and nobody responded',
      },
    });

    await this.realtimeService.emitIncident('incident.updated', incidentId);
  }

  async autoResolveQuietIncidents() {
    const incidents = await this.prisma.incident.findMany({
      where: {
        status: { not: 'RESOLVED' },
        service: { autoResolveMinutes: { not: null } },
      },
      include: { service: true },
    });

    for (const incident of incidents) {
      const minutes = incident.service.autoResolveMinutes!;
      const quietSince = Date.now() - incident.lastAlertAt.getTime();
      if (quietSince < minutes * 60 * 1000) {
        continue;
      }

      const updated = await this.prisma.incident.updateMany({
        where: {
          id: incident.id,
          status: { not: 'RESOLVED' },
          lastAlertAt: incident.lastAlertAt,
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          nextEscalationAt: null,
        },
      });
      if (updated.count === 0) {
        continue;
      }

      await this.prisma.incidentEvent.create({
        data: {
          incidentId: incident.id,
          type: 'AUTO_RESOLVED',
          actorType: 'SYSTEM',
          message: `No alerts for ${minutes} minutes. Resolved automatically`,
        },
      });

      await this.realtimeService.emitIncident(
        'incident.resolved',
        incident.id,
        null,
      );
    }
  }
}
