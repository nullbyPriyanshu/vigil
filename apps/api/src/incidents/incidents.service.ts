import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EscalationService } from 'src/escalation/escalation.service';
import { PrismaService } from 'src/prisma.service';
import { RealtimeService } from 'src/realtime/realtime.service';
import { CreateNoteDto } from './dto/createNote.dto';
import { ListIncidentsDto, PaginationDto } from './dto/listIncidents.dto';
import { ResolveIncidentDto } from './dto/resolveIncident.dto';

function toPerson(user: { id: string; name: string } | null) {
  if (!user) {
    return null;
  }
  return { id: user.id, name: user.name };
}

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly escalationService: EscalationService,
  ) {}

  async listIncidents(organizationId: string, query: ListIncidentsDto) {
    const where = {
      organizationId,
      status: query.status,
      severity: query.severity,
      serviceId: query.service,
    };

    const total = await this.prisma.incident.count({ where });

    const incidents = await this.prisma.incident.findMany({
      where,
      include: {
        service: {
          include: { escalationPolicy: { include: { steps: true } } },
        },
        alerts: true,
        acknowledgedBy: true,
        resolvedBy: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    const data = incidents.map((incident) => ({
      id: incident.id,
      number: incident.number,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      service: { id: incident.service.id, name: incident.service.name },
      alertCount: incident.alerts.length,
      currentStepPosition: incident.currentStepPosition,
      totalSteps: incident.service.escalationPolicy.steps.length,
      acknowledgedBy: toPerson(incident.acknowledgedBy),
      acknowledgedAt: incident.acknowledgedAt,
      resolvedBy: toPerson(incident.resolvedBy),
      resolvedAt: incident.resolvedAt,
      lastAlertAt: incident.lastAlertAt,
      createdAt: incident.createdAt,
    }));

    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getIncidentByNumber(organizationId: string, number: number) {
    const incident = await this.prisma.incident.findUnique({
      where: { organizationId_number: { organizationId, number } },
    });
    if (!incident) {
      throw new NotFoundException(`No incident INC-${number} here`);
    }

    return this.getIncident(organizationId, incident.id);
  }

  async getIncident(organizationId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, organizationId },
      include: {
        service: {
          include: {
            team: true,
            escalationPolicy: {
              include: {
                steps: {
                  include: { user: true, team: true, schedule: true },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
        alerts: true,
        notifications: { include: { user: true } },
        acknowledgedBy: true,
        resolvedBy: true,
      },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const policy = incident.service.escalationPolicy;

    const steps = policy.steps.map((step) => {
      let targetName = 'Removed';
      if (step.user) targetName = step.user.name;
      if (step.team) targetName = step.team.name;
      if (step.schedule) targetName = step.schedule.name;

      const notifications = incident.notifications.filter(
        (notification) => notification.stepPosition === step.position,
      );

      return {
        position: step.position,
        delayMinutes: step.delayMinutes,
        targetType: step.targetType,
        targetName,
        state: notifications.length > 0 ? 'notified' : 'pending',
        notifiedUsers: notifications.map((notification) => ({
          name: notification.user.name,
          at: notification.createdAt,
          status: notification.status,
        })),
      };
    });

    return {
      id: incident.id,
      number: incident.number,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      status: incident.status,
      dedupKey: incident.dedupKey,
      service: { id: incident.service.id, name: incident.service.name },
      team: {
        id: incident.service.team.id,
        name: incident.service.team.name,
      },
      alertCount: incident.alerts.length,
      createdAt: incident.createdAt,
      lastAlertAt: incident.lastAlertAt,
      acknowledgedBy: toPerson(incident.acknowledgedBy),
      acknowledgedAt: incident.acknowledgedAt,
      resolvedBy: toPerson(incident.resolvedBy),
      resolvedAt: incident.resolvedAt,
      escalation: {
        policy: { id: policy.id, name: policy.name },
        currentStepPosition: incident.currentStepPosition,
        round: incident.escalationRound,
        repeatCount: policy.repeatCount,
        nextEscalationAt: incident.nextEscalationAt,
        steps,
      },
    };
  }

  async listEvents(organizationId: string, incidentId: string) {
    await this.findIncidentOrThrow(organizationId, incidentId);

    const events = await this.prisma.incidentEvent.findMany({
      where: { incidentId },
      include: { actor: true },
      orderBy: { createdAt: 'asc' },
    });

    const data = events.map((event) => ({
      id: event.id,
      type: event.type,
      actorType: event.actorType,
      actor: toPerson(event.actor),
      message: event.message,
      metadata: event.metadata,
      createdAt: event.createdAt,
    }));

    return { data };
  }

  async listAlerts(
    organizationId: string,
    incidentId: string,
    query: PaginationDto,
  ) {
    await this.findIncidentOrThrow(organizationId, incidentId);

    const total = await this.prisma.alert.count({ where: { incidentId } });

    const alerts = await this.prisma.alert.findMany({
      where: { incidentId },
      orderBy: { receivedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    const data = alerts.map((alert) => ({
      id: alert.id,
      dedupKey: alert.dedupKey,
      title: alert.title,
      severity: alert.severity,
      status: alert.status,
      payload: alert.payload,
      receivedAt: alert.receivedAt,
    }));

    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async acknowledge(
    userId: string,
    organizationId: string,
    incidentId: string,
  ) {
    const user = await this.findResponderOrThrow(userId, organizationId);
    await this.findIncidentOrThrow(organizationId, incidentId);

    const updated = await this.prisma.incident.updateMany({
      where: { id: incidentId, status: 'TRIGGERED' },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedById: user.id,
        nextEscalationAt: null,
      },
    });

    if (updated.count === 0) {
      await this.throwAlreadyHandled(incidentId);
    }

    await this.prisma.incidentEvent.create({
      data: {
        incidentId,
        type: 'ACKNOWLEDGED',
        actorType: 'USER',
        actorId: user.id,
        message: `Acknowledged by ${user.name}`,
      },
    });

    await this.escalationService.cancel(incidentId);
    await this.realtimeService.emitIncident(
      'incident.acknowledged',
      incidentId,
      { id: user.id, name: user.name },
    );

    return { incident: await this.getIncident(organizationId, incidentId) };
  }

  async resolve(
    userId: string,
    organizationId: string,
    incidentId: string,
    dto: ResolveIncidentDto,
  ) {
    const user = await this.findResponderOrThrow(userId, organizationId);
    await this.findIncidentOrThrow(organizationId, incidentId);

    const updated = await this.prisma.incident.updateMany({
      where: { id: incidentId, status: { in: ['TRIGGERED', 'ACKNOWLEDGED'] } },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: user.id,
        nextEscalationAt: null,
      },
    });

    if (updated.count === 0) {
      await this.throwAlreadyHandled(incidentId);
    }

    if (dto.note) {
      await this.prisma.incidentEvent.create({
        data: {
          incidentId,
          type: 'COMMENT',
          actorType: 'USER',
          actorId: user.id,
          message: dto.note,
        },
      });
    }

    await this.prisma.incidentEvent.create({
      data: {
        incidentId,
        type: 'RESOLVED',
        actorType: 'USER',
        actorId: user.id,
        message: `Resolved by ${user.name}`,
      },
    });

    await this.escalationService.cancel(incidentId);
    await this.realtimeService.emitIncident('incident.resolved', incidentId, {
      id: user.id,
      name: user.name,
    });

    return { incident: await this.getIncident(organizationId, incidentId) };
  }

  async addNote(
    userId: string,
    organizationId: string,
    incidentId: string,
    dto: CreateNoteDto,
  ) {
    const user = await this.findResponderOrThrow(userId, organizationId);
    await this.findIncidentOrThrow(organizationId, incidentId);

    const event = await this.prisma.incidentEvent.create({
      data: {
        incidentId,
        type: 'COMMENT',
        actorType: 'USER',
        actorId: user.id,
        message: dto.message,
      },
    });

    return {
      id: event.id,
      type: event.type,
      actorType: event.actorType,
      actor: { id: user.id, name: user.name },
      message: event.message,
      metadata: event.metadata,
      createdAt: event.createdAt,
    };
  }

  private async findResponderOrThrow(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: true },
    });

    if (!membership || membership.role === 'VIEWER') {
      throw new ForbiddenException('Viewers cannot respond to incidents');
    }

    return membership.user;
  }

  private async findIncidentOrThrow(
    organizationId: string,
    incidentId: string,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, organizationId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }

  private async throwAlreadyHandled(incidentId: string) {
    const incident = await this.prisma.incident.findUniqueOrThrow({
      where: { id: incidentId },
      include: { acknowledgedBy: true, resolvedBy: true },
    });

    if (incident.status === 'RESOLVED') {
      throw new ConflictException({
        code: 'ALREADY_RESOLVED',
        message: incident.resolvedBy
          ? `Already resolved by ${incident.resolvedBy.name}`
          : 'Already resolved',
        resolvedBy: toPerson(incident.resolvedBy),
        resolvedAt: incident.resolvedAt,
        status: incident.status,
      });
    }

    throw new ConflictException({
      code: 'ALREADY_ACKNOWLEDGED',
      message: incident.acknowledgedBy
        ? `Already acknowledged by ${incident.acknowledgedBy.name}`
        : 'Already acknowledged',
      acknowledgedBy: toPerson(incident.acknowledgedBy),
      acknowledgedAt: incident.acknowledgedAt,
      status: incident.status,
    });
  }
}
