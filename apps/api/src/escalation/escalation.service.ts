import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma.service';

export const ESCALATION_QUEUE = 'escalation';

export type StepJob = {
  incidentId: string;
  stepPosition: number;
  round: number;
};

export function getStepJobId(job: StepJob) {
  return `esc-${job.incidentId}-${job.stepPosition}-${job.round}`;
}

export function getFinishJobId(incidentId: string) {
  return `esc-${incidentId}-finish`;
}

@Injectable()
export class EscalationService implements OnModuleInit {
  constructor(
    @InjectQueue(ESCALATION_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'auto-resolve',
      { every: 60 * 1000 },
      { name: 'auto-resolve' },
    );
  }

  async start(incidentId: string) {
    const job = { incidentId, stepPosition: 1, round: 0 };

    await this.queue.add('step', job, {
      jobId: getStepJobId(job),
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  async cancel(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      return;
    }

    const jobIds = [
      getStepJobId({
        incidentId,
        stepPosition: incident.currentStepPosition + 1,
        round: incident.escalationRound,
      }),
      getStepJobId({
        incidentId,
        stepPosition: 1,
        round: incident.escalationRound + 1,
      }),
      getFinishJobId(incidentId),
    ];

    for (const jobId of jobIds) {
      try {
        const job = await this.queue.getJob(jobId);
        if (job) {
          await job.remove();
        }
      } catch {
        continue;
      }
    }
  }
}
