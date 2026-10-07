import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

type IncidentEventName =
  | 'incident.created'
  | 'incident.updated'
  | 'incident.acknowledged'
  | 'incident.resolved';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async emitIncident(
    event: IncidentEventName,
    incidentId: string,
    by?: { id: string; name: string } | null,
  ) {
    try {
      const incident = await this.prisma.incident.findUnique({
        where: { id: incidentId },
        include: {
          service: {
            include: { escalationPolicy: { include: { steps: true } } },
          },
          alerts: true,
          acknowledgedBy: true,
          resolvedBy: true,
        },
      });
      if (!incident) {
        return;
      }

      const payload: Record<string, unknown> = {
        incident: {
          id: incident.id,
          number: incident.number,
          title: incident.title,
          severity: incident.severity,
          status: incident.status,
          service: { id: incident.service.id, name: incident.service.name },
          alertCount: incident.alerts.length,
          currentStepPosition: incident.currentStepPosition,
          totalSteps: incident.service.escalationPolicy.steps.length,
          acknowledgedBy: incident.acknowledgedBy
            ? {
                id: incident.acknowledgedBy.id,
                name: incident.acknowledgedBy.name,
              }
            : null,
          acknowledgedAt: incident.acknowledgedAt,
          resolvedBy: incident.resolvedBy
            ? { id: incident.resolvedBy.id, name: incident.resolvedBy.name }
            : null,
          resolvedAt: incident.resolvedAt,
          lastAlertAt: incident.lastAlertAt,
          createdAt: incident.createdAt,
        },
      };

      if (by !== undefined) {
        payload.by = by;
      }

      this.gateway.server
        .to(`org:${incident.organizationId}`)
        .emit(event, payload);
    } catch (error) {
      this.logger.error(`Could not send ${event}`, error);
    }
  }
}
