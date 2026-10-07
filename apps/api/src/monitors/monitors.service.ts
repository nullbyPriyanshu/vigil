import { lookup } from 'dns/promises';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { AlertsService } from 'src/alerts/alerts.service';
import { PrismaService } from 'src/prisma.service';
import { CreateMonitorDto } from './dto/createMonitor.dto';
import { UpdateMonitorDto } from './dto/updateMonitor.dto';

export const MONITORS_QUEUE = 'monitors';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const TIMEOUT_MS = 10 * 1000;
const FAILS_BEFORE_ALERT = 2;
const KEEP_CHECKS_DAYS = 30;

type MonitorRow = {
  id: string;
  name: string;
  url: string;
  intervalMinutes: number;
  status: 'PENDING' | 'UP' | 'DOWN';
  failCount: number;
  lastCheckedAt: Date | null;
  organizationId: string;
  serviceId: string;
};

@Injectable()
export class MonitorsService implements OnModuleInit {
  constructor(
    @InjectQueue(MONITORS_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'check-monitors',
      { every: MINUTE },
      { name: 'check-monitors' },
    );
  }

  async listMonitors(organizationId: string) {
    const monitors = await this.prisma.monitor.findMany({
      where: { organizationId },
      include: { service: true },
      orderBy: { name: 'asc' },
    });

    const data = monitors.map((monitor) => ({
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      intervalMinutes: monitor.intervalMinutes,
      status: monitor.status,
      lastCheckedAt: monitor.lastCheckedAt,
      lastResponseMs: monitor.lastResponseMs,
      service: { id: monitor.service.id, name: monitor.service.name },
    }));

    return { data };
  }

  async getMonitor(organizationId: string, monitorId: string) {
    const monitor = await this.findMonitorOrThrow(organizationId, monitorId);

    const checks = await this.prisma.monitorCheck.findMany({
      where: { monitorId },
      orderBy: { checkedAt: 'desc' },
      take: 60,
    });

    const since = new Date(Date.now() - KEEP_CHECKS_DAYS * DAY);
    const total = await this.prisma.monitorCheck.count({
      where: { monitorId, checkedAt: { gte: since } },
    });
    const up = await this.prisma.monitorCheck.count({
      where: { monitorId, checkedAt: { gte: since }, up: true },
    });

    return {
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      intervalMinutes: monitor.intervalMinutes,
      status: monitor.status,
      lastCheckedAt: monitor.lastCheckedAt,
      lastResponseMs: monitor.lastResponseMs,
      createdAt: monitor.createdAt,
      service: { id: monitor.service.id, name: monitor.service.name },
      uptimePercent: total === 0 ? null : Math.round((up / total) * 1000) / 10,
      checks: checks.map((check) => ({
        id: check.id,
        up: check.up,
        statusCode: check.statusCode,
        responseMs: check.responseMs,
        error: check.error,
        checkedAt: check.checkedAt,
      })),
    };
  }

  async createMonitor(organizationId: string, dto: CreateMonitorDto) {
    await this.findServiceOrThrow(organizationId, dto.serviceId);
    await this.assertSafeUrl(dto.url);

    const monitor = await this.prisma.monitor.create({
      data: {
        name: dto.name,
        url: dto.url,
        intervalMinutes: dto.intervalMinutes,
        serviceId: dto.serviceId,
        organizationId,
      },
    });

    await this.checkMonitor(monitor);

    return this.getMonitor(organizationId, monitor.id);
  }

  async updateMonitor(
    organizationId: string,
    monitorId: string,
    dto: UpdateMonitorDto,
  ) {
    await this.findMonitorOrThrow(organizationId, monitorId);

    if (dto.serviceId) {
      await this.findServiceOrThrow(organizationId, dto.serviceId);
    }
    if (dto.url) {
      await this.assertSafeUrl(dto.url);
    }

    await this.prisma.monitor.update({
      where: { id: monitorId },
      data: {
        name: dto.name,
        url: dto.url,
        intervalMinutes: dto.intervalMinutes,
        serviceId: dto.serviceId,
      },
    });

    return this.getMonitor(organizationId, monitorId);
  }

  async deleteMonitor(organizationId: string, monitorId: string) {
    const monitor = await this.findMonitorOrThrow(organizationId, monitorId);

    if (monitor.status === 'DOWN') {
      await this.sendAlert(monitor, 'resolved', 'The monitor was deleted');
    }

    await this.prisma.monitor.delete({ where: { id: monitorId } });
  }

  async checkNow(organizationId: string, monitorId: string) {
    const monitor = await this.findMonitorOrThrow(organizationId, monitorId);

    await this.checkMonitor(monitor);

    return this.getMonitor(organizationId, monitorId);
  }

  async checkDueMonitors() {
    await this.keepAwake();

    const monitors = await this.prisma.monitor.findMany();
    const now = Date.now();

    for (const monitor of monitors) {
      const waitMs = monitor.intervalMinutes * MINUTE - 5000;
      const isDue =
        !monitor.lastCheckedAt ||
        now - monitor.lastCheckedAt.getTime() >= waitMs;

      if (isDue) {
        await this.checkMonitor(monitor);
      }
    }

    await this.prisma.monitorCheck.deleteMany({
      where: { checkedAt: { lt: new Date(now - KEEP_CHECKS_DAYS * DAY) } },
    });
  }

  async checkMonitor(monitor: MonitorRow) {
    const result = await this.visit(monitor.url);

    await this.prisma.monitorCheck.create({
      data: {
        monitorId: monitor.id,
        up: result.up,
        statusCode: result.statusCode,
        responseMs: result.responseMs,
        error: result.error,
      },
    });

    const failCount = result.up ? 0 : monitor.failCount + 1;

    let status = monitor.status;
    if (result.up) {
      status = 'UP';
    } else if (failCount >= FAILS_BEFORE_ALERT) {
      status = 'DOWN';
    }

    await this.prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        status,
        failCount,
        lastCheckedAt: new Date(),
        lastResponseMs: result.up ? result.responseMs : null,
      },
    });

    if (status === 'DOWN' && monitor.status !== 'DOWN') {
      await this.sendAlert(monitor, 'triggered', result.error ?? 'No answer');
    }
    if (status === 'UP' && monitor.status === 'DOWN') {
      await this.sendAlert(
        monitor,
        'resolved',
        'The address is answering again',
      );
    }
  }

  private async keepAwake() {
    const url = process.env.KEEP_AWAKE_URL;
    if (!url) {
      return;
    }

    try {
      await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      return;
    }
  }

  private async visit(url: string) {
    const startedAt = Date.now();

    try {
      await this.assertSafeUrl(url);

      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const up = response.status < 400;

      return {
        up,
        statusCode: response.status,
        responseMs: Date.now() - startedAt,
        error: up ? null : `Answered with status ${response.status}`,
      };
    } catch (error) {
      let message = 'Could not connect';
      if (error instanceof BadRequestException) {
        message = error.message;
      } else if (error instanceof Error && error.name === 'TimeoutError') {
        message = `No answer within ${TIMEOUT_MS / 1000} seconds`;
      }

      return {
        up: false,
        statusCode: null,
        responseMs: Date.now() - startedAt,
        error: message,
      };
    }
  }

  private async sendAlert(
    monitor: MonitorRow,
    status: 'triggered' | 'resolved',
    reason: string,
  ) {
    const alert = {
      title: `${monitor.name} is down`,
      dedup_key: `monitor-${monitor.id}`,
      severity: 'high' as const,
      status,
      description: `Uptime check for ${monitor.url}: ${reason}`,
    };

    await this.alertsService.createAlert(
      { serviceId: monitor.serviceId, organizationId: monitor.organizationId },
      alert,
      { ...alert, source: 'uptime-check' },
    );
  }

  private async assertSafeUrl(url: string) {
    if (process.env.ALLOW_PRIVATE_MONITOR_URLS === 'true') {
      return;
    }

    const hostname = new URL(url).hostname.replace('[', '').replace(']', '');

    let address = '';
    try {
      const found = await lookup(hostname);
      address = found.address;
    } catch {
      throw new BadRequestException('This address could not be found');
    }

    if (this.isPrivateAddress(address)) {
      throw new BadRequestException(
        'This address is on a private network and cannot be monitored',
      );
    }
  }

  private isPrivateAddress(address: string) {
    const ip = address.toLowerCase().replace('::ffff:', '');

    if (ip === '::1' || ip === '::') {
      return true;
    }
    if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) {
      return true;
    }

    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) {
      return false;
    }

    return (
      parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }

  private async findMonitorOrThrow(organizationId: string, monitorId: string) {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id: monitorId, organizationId },
      include: { service: true },
    });
    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    return monitor;
  }

  private async findServiceOrThrow(organizationId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, organizationId },
    });
    if (!service) {
      throw new BadRequestException('That service does not exist');
    }

    return service;
  }
}
