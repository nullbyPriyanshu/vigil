import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from 'src/prisma.service';

function average(numbers: number[]) {
  if (numbers.length === 0) {
    return null;
  }
  const total = numbers.reduce((sum, n) => sum + n, 0);
  return Math.round(total / numbers.length);
}

function secondsBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / 1000;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, organizationId: string, days: number) {
    const timezone = await this.getTimezone(userId);
    const incidents = await this.findIncidents(organizationId, days, timezone);

    const openTriggered = await this.prisma.incident.count({
      where: { organizationId, status: 'TRIGGERED' },
    });
    const openAcknowledged = await this.prisma.incident.count({
      where: { organizationId, status: 'ACKNOWLEDGED' },
    });

    const firstDay = this.getFirstDay(days, timezone);
    const previousTotalIncidents = await this.prisma.incident.count({
      where: {
        organizationId,
        createdAt: {
          gte: firstDay.minus({ days }).toJSDate(),
          lt: firstDay.toJSDate(),
        },
      },
    });

    const escalated = incidents.filter(
      (incident) =>
        incident.currentStepPosition > 1 || incident.escalationRound > 0,
    );

    return {
      days,
      openTriggered,
      openAcknowledged,
      totalIncidents: incidents.length,
      previousTotalIncidents,
      mttaSeconds: this.getMtta(incidents),
      mttrSeconds: this.getMttr(incidents),
      escalationRate:
        incidents.length === 0
          ? 0
          : Math.round((escalated.length / incidents.length) * 100) / 100,
      bySeverity: {
        CRITICAL: incidents.filter((i) => i.severity === 'CRITICAL').length,
        HIGH: incidents.filter((i) => i.severity === 'HIGH').length,
        LOW: incidents.filter((i) => i.severity === 'LOW').length,
      },
      incidentsByDay: this.countByDay(incidents, days, timezone),
    };
  }

  async getIncidentsOverTime(
    userId: string,
    organizationId: string,
    days: number,
  ) {
    const timezone = await this.getTimezone(userId);
    const incidents = await this.findIncidents(organizationId, days, timezone);

    return { days, series: this.countByDay(incidents, days, timezone) };
  }

  async getByService(userId: string, organizationId: string, days: number) {
    const timezone = await this.getTimezone(userId);
    const incidents = await this.findIncidents(organizationId, days, timezone);

    const services = await this.prisma.service.findMany({
      where: { organizationId },
    });

    const data = services.map((service) => {
      const ofService = incidents.filter(
        (incident) => incident.serviceId === service.id,
      );

      return {
        service: { id: service.id, name: service.name },
        count: ofService.length,
        mttaSeconds: this.getMtta(ofService),
        mttrSeconds: this.getMttr(ofService),
      };
    });

    data.sort((a, b) => b.count - a.count);

    return { data };
  }

  private async getTimezone(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? user.timezone : 'UTC';
  }

  private getFirstDay(days: number, timezone: string) {
    return DateTime.now()
      .setZone(timezone)
      .startOf('day')
      .minus({ days: days - 1 });
  }

  private findIncidents(
    organizationId: string,
    days: number,
    timezone: string,
  ) {
    const firstDay = this.getFirstDay(days, timezone);

    return this.prisma.incident.findMany({
      where: { organizationId, createdAt: { gte: firstDay.toJSDate() } },
    });
  }

  private countByDay(
    incidents: { createdAt: Date }[],
    days: number,
    timezone: string,
  ) {
    const today = DateTime.now().setZone(timezone).startOf('day');
    const result: { date: string; count: number }[] = [];

    for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
      const date = today.minus({ days: daysAgo }).toISODate()!;
      const count = incidents.filter(
        (incident) =>
          DateTime.fromJSDate(incident.createdAt, {
            zone: timezone,
          }).toISODate() === date,
      ).length;

      result.push({ date, count });
    }

    return result;
  }

  private getMtta(
    incidents: { createdAt: Date; acknowledgedAt: Date | null }[],
  ) {
    const times: number[] = [];
    for (const incident of incidents) {
      if (incident.acknowledgedAt) {
        times.push(secondsBetween(incident.createdAt, incident.acknowledgedAt));
      }
    }
    return average(times);
  }

  private getMttr(incidents: { createdAt: Date; resolvedAt: Date | null }[]) {
    const times: number[] = [];
    for (const incident of incidents) {
      if (incident.resolvedAt) {
        times.push(secondsBetween(incident.createdAt, incident.resolvedAt));
      }
    }
    return average(times);
  }
}
