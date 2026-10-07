import { Injectable } from '@nestjs/common';
import { ApiKeysService } from 'src/api-keys/api-keys.service';
import { EscalationService } from 'src/escalation/escalation.service';
import { PrismaService } from 'src/prisma.service';
import { RealtimeService } from 'src/realtime/realtime.service';
import { CreateAlertDto } from './dto/createAlert.dto';

export type AlertSource = {
  id?: string;
  serviceId: string;
  organizationId: string;
};

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeysService: ApiKeysService,
    private readonly escalationService: EscalationService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async createAlert(
    apiKey: AlertSource,
    dto: CreateAlertDto,
    payload: object,
    idempotencyKey?: string,
  ) {
    const serviceId = apiKey.serviceId;
    const severity =
      dto.severity === 'critical'
        ? 'CRITICAL'
        : dto.severity === 'low'
          ? 'LOW'
          : 'HIGH';
    const status = dto.status === 'resolved' ? 'RESOLVED' : 'TRIGGERED';
    const dedupKey = dto.dedup_key ?? null;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;

      if (idempotencyKey) {
        const sameRequest = await tx.alert.findFirst({
          where: { serviceId, idempotencyKey },
          include: { incident: true },
        });
        if (sameRequest) {
          return {
            alert: sameRequest,
            incident: sameRequest.incident,
            isNewIncident: false,
          };
        }
      }

      let incident = dedupKey
        ? await tx.incident.findFirst({
            where: { serviceId, dedupKey, status: { not: 'RESOLVED' } },
          })
        : null;
      let isNewIncident = false;

      if (status === 'RESOLVED') {
        if (incident) {
          await tx.incident.update({
            where: { id: incident.id },
            data: {
              status: 'RESOLVED',
              resolvedAt: new Date(),
              nextEscalationAt: null,
            },
          });
          await tx.incidentEvent.create({
            data: {
              incidentId: incident.id,
              type: 'RESOLVED',
              actorType: 'INTEGRATION',
              message: 'Resolved by an alert from the monitoring tool',
            },
          });
        }
      } else if (incident) {
        await tx.incident.update({
          where: { id: incident.id },
          data: { lastAlertAt: new Date() },
        });
      } else {
        const organization = await tx.organization.update({
          where: { id: apiKey.organizationId },
          data: { incidentCounter: { increment: 1 } },
        });

        incident = await tx.incident.create({
          data: {
            number: organization.incidentCounter,
            title: dto.title,
            description: dto.description ?? null,
            severity,
            dedupKey,
            organizationId: apiKey.organizationId,
            serviceId,
          },
        });
        isNewIncident = true;

        await tx.incidentEvent.create({
          data: {
            incidentId: incident.id,
            type: 'CREATED',
            actorType: 'INTEGRATION',
            message: 'Incident created from alert',
          },
        });
      }

      const alert = await tx.alert.create({
        data: {
          title: dto.title,
          severity,
          status,
          dedupKey,
          payload,
          deduplicated: status === 'TRIGGERED' && !isNewIncident,
          idempotencyKey: idempotencyKey ?? null,
          serviceId,
          apiKeyId: apiKey.id ?? null,
          incidentId: incident ? incident.id : null,
        },
      });

      return { alert, incident, isNewIncident };
    });

    if (apiKey.id) {
      await this.apiKeysService.markKeyUsed(apiKey.id);
    }

    if (result.incident) {
      if (result.isNewIncident) {
        void this.announceNewIncident(result.incident.id);
      } else if (result.alert.status === 'RESOLVED') {
        void this.escalationService.cancel(result.incident.id);
        void this.realtimeService.emitIncident(
          'incident.resolved',
          result.incident.id,
          null,
        );
      } else {
        void this.realtimeService.emitIncident(
          'incident.updated',
          result.incident.id,
        );
      }
    }

    const body = {
      alert_id: result.alert.id,
      incident_id: result.incident ? result.incident.id : null,
      incident_number: result.incident ? result.incident.number : null,
    };

    if (result.alert.status === 'RESOLVED') {
      return {
        created: false,
        body: { ...body, action: 'resolved' },
      };
    }

    return {
      created: result.isNewIncident,
      body: { ...body, deduplicated: result.alert.deduplicated },
    };
  }

  private async announceNewIncident(incidentId: string) {
    await this.realtimeService.emitIncident('incident.created', incidentId);
    await this.escalationService.start(incidentId);
  }
}
