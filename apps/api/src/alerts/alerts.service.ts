import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiKeysService } from 'src/api-keys/api-keys.service';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { parseAlert, type AlertInput } from './alert.validation';
import type { CurrentApiKey } from './apiKey.guard';
import { SOURCES } from './sources';

// What goes back to the sender. `created` decides between 201 and 200.
export type IngestResult = {
  created: boolean;
  body: {
    alert_id: string;
    incident_id: string | null;
    incident_number: number | null;
    deduplicated?: boolean;
    action?: 'resolved';
  };
};

// The database client inside a transaction.
type Tx = Prisma.TransactionClient;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  // POST /alerts: the body is already in Vigil's own shape.
  async ingestAlert(
    apiKey: CurrentApiKey,
    body: unknown,
    idempotencyKey?: string,
  ) {
    const alert = parseAlert(body);
    return this.ingest(apiKey, alert, body, idempotencyKey);
  }

  // POST /alerts/:source: translate another tool's webhook first.
  async ingestFromSource(
    apiKey: CurrentApiKey,
    source: string,
    body: unknown,
    idempotencyKey?: string,
  ) {
    const translate = SOURCES[source.toLowerCase()];
    if (!translate) {
      throw new BadRequestException(
        `Unsupported source "${source}". Use one of: ${Object.keys(SOURCES).join(', ')}`,
      );
    }

    const isObject =
      typeof body === 'object' && body !== null && !Array.isArray(body);
    const translated = isObject
      ? translate(body as Record<string, unknown>)
      : null;
    if (!translated) {
      throw new BadRequestException(
        `This doesn't look like a ${source} webhook payload`,
      );
    }

    // The translated alert is checked like any other; the stored payload is
    // still the tool's original body.
    return this.ingest(apiKey, parseAlert(translated), body, idempotencyKey);
  }

  // The pipeline every alert goes through:
  //   1. a retry of a request we've already handled gets the same answer
  //   2. "resolved" closes the open incident with the same dedup key
  //   3. "triggered" joins that open incident if there is one
  //   4. otherwise it becomes a new incident
  private async ingest(
    apiKey: CurrentApiKey,
    alert: AlertInput,
    rawBody: unknown,
    idempotencyKey?: string,
  ): Promise<IngestResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Lock this service's row until the transaction ends. Two alerts for
      // the same service now run one after the other, so they can't both
      // decide "nothing is open" and create two incidents for one problem.
      await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${apiKey.serviceId} FOR UPDATE`;

      if (idempotencyKey) {
        const earlier = await this.findEarlierResult(
          tx,
          apiKey.serviceId,
          idempotencyKey,
        );
        if (earlier) return earlier;
      }

      // What every alert row has in common, whichever branch stores it.
      const alertData = {
        title: alert.title,
        severity: alert.severity,
        status: alert.status,
        dedupKey: alert.dedupKey,
        payload: rawBody as Prisma.InputJsonValue,
        idempotencyKey: idempotencyKey ?? null,
        serviceId: apiKey.serviceId,
        apiKeyId: apiKey.id,
      };

      // An alert without a dedup key can't match anything.
      const openIncident = alert.dedupKey
        ? await tx.incident.findFirst({
            where: {
              serviceId: apiKey.serviceId,
              dedupKey: alert.dedupKey,
              status: { not: 'RESOLVED' },
            },
          })
        : null;

      if (alert.status === 'RESOLVED') {
        return this.resolveFromAlert(tx, alertData, openIncident);
      }
      if (openIncident) {
        return this.attachToIncident(tx, alertData, openIncident);
      }
      return this.createIncident(tx, apiKey, alert, alertData);
    });

    await this.apiKeysService.markKeyUsed(apiKey.id);

    return result;
  }

  // ---------- The four outcomes ----------

  private async findEarlierResult(
    tx: Tx,
    serviceId: string,
    idempotencyKey: string,
  ): Promise<IngestResult | null> {
    const earlier = await tx.alert.findUnique({
      where: { serviceId_idempotencyKey: { serviceId, idempotencyKey } },
      include: { incident: true },
    });
    if (!earlier) return null;

    const ids = {
      alert_id: earlier.id,
      incident_id: earlier.incidentId,
      incident_number: earlier.incident?.number ?? null,
    };

    // Nothing new was made this time, so it's a 200 either way.
    return {
      created: false,
      body:
        earlier.status === 'RESOLVED'
          ? { ...ids, action: 'resolved' }
          : { ...ids, deduplicated: earlier.deduplicated },
    };
  }

  private async resolveFromAlert(
    tx: Tx,
    alertData: Prisma.AlertUncheckedCreateInput,
    openIncident: { id: string; number: number } | null,
  ): Promise<IngestResult> {
    // The alert is stored even when there's nothing to close, so there's a
    // record that it arrived.
    const stored = await tx.alert.create({
      data: { ...alertData, incidentId: openIncident?.id ?? null },
    });

    if (openIncident) {
      await tx.incident.update({
        where: { id: openIncident.id },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: openIncident.id,
          type: 'RESOLVED',
          actorType: 'INTEGRATION',
          message: 'Resolved by an alert from the monitoring tool',
        },
      });
      // TODO (escalation): cancel this incident's pending escalation here.
    }

    return {
      created: false,
      body: {
        alert_id: stored.id,
        incident_id: openIncident?.id ?? null,
        incident_number: openIncident?.number ?? null,
        action: 'resolved',
      },
    };
  }

  private async attachToIncident(
    tx: Tx,
    alertData: Prisma.AlertUncheckedCreateInput,
    openIncident: { id: string; number: number },
  ): Promise<IngestResult> {
    const stored = await tx.alert.create({
      data: { ...alertData, incidentId: openIncident.id, deduplicated: true },
    });
    await tx.incident.update({
      where: { id: openIncident.id },
      data: { lastAlertAt: stored.receivedAt },
    });

    return {
      created: false,
      body: {
        alert_id: stored.id,
        incident_id: openIncident.id,
        incident_number: openIncident.number,
        deduplicated: true,
      },
    };
  }

  private async createIncident(
    tx: Tx,
    apiKey: CurrentApiKey,
    alert: AlertInput,
    alertData: Prisma.AlertUncheckedCreateInput,
  ): Promise<IngestResult> {
    // Adding 1 to the organization's counter and reading the result is one
    // step in the database, so two incidents can never get the same number.
    const organization = await tx.organization.update({
      where: { id: apiKey.organizationId },
      data: { incidentCounter: { increment: 1 } },
    });

    const incident = await tx.incident.create({
      data: {
        number: organization.incidentCounter,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        dedupKey: alert.dedupKey,
        organizationId: apiKey.organizationId,
        serviceId: apiKey.serviceId,
      },
    });
    const stored = await tx.alert.create({
      data: { ...alertData, incidentId: incident.id },
    });
    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: 'CREATED',
        actorType: 'INTEGRATION',
        message: 'Incident created from alert',
      },
    });

    // TODO (escalation): start the service's escalation policy here, i.e.
    // notify step 1 and schedule the move to step 2.

    return {
      created: true,
      body: {
        alert_id: stored.id,
        incident_id: incident.id,
        incident_number: incident.number,
        deduplicated: false,
      },
    };
  }
}
