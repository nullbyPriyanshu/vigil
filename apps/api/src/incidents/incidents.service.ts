import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { canRespond } from 'src/common/permissions';
import { EscalationPoliciesService } from 'src/escalation-policies/escalation-policies.service';
import { PrismaService } from 'src/prisma.service';
import { CreateNoteDto } from './dto/createNote.dto';
import { ListIncidentsDto, PaginationDto } from './dto/listIncidents.dto';
import { ResolveIncidentDto } from './dto/resolveIncident.dto';

// A person as the API shows them next to "acknowledged by" and so on.
const PERSON = { select: { id: true, name: true } } as const;

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escalationPoliciesService: EscalationPoliciesService,
  ) {}

  // ---------- Reading (any role) ----------

  async listIncidents(organizationId: string, query: ListIncidentsDto) {
    // Filters that weren't sent are `undefined`, which Prisma ignores.
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
          include: {
            escalationPolicy: {
              include: { _count: { select: { steps: true } } },
            },
          },
        },
        acknowledgedBy: PERSON,
        resolvedBy: PERSON,
        _count: { select: { alerts: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      data: incidents.map((incident) => ({
        id: incident.id,
        number: incident.number,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        service: { id: incident.service.id, name: incident.service.name },
        alertCount: incident._count.alerts,
        currentStepPosition: incident.currentStepPosition,
        totalSteps: incident.service.escalationPolicy._count.steps,
        acknowledgedBy: incident.acknowledgedBy,
        acknowledgedAt: incident.acknowledgedAt,
        resolvedBy: incident.resolvedBy,
        resolvedAt: incident.resolvedAt,
        lastAlertAt: incident.lastAlertAt,
        createdAt: incident.createdAt,
      })),
      meta: this.toMeta(query, total),
    };
  }

  // Looked up by the number people say out loud: INC-142 -> 142.
  async getIncidentByNumber(organizationId: string, number: number) {
    const incident = await this.prisma.incident.findUnique({
      where: { organizationId_number: { organizationId, number } },
    });
    if (!incident) {
      throw new NotFoundException(`No incident INC-${number} here`);
    }
    return this.loadFullIncident(organizationId, incident.id);
  }

  // The timeline, oldest first.
  async listEvents(organizationId: string, incidentId: string) {
    await this.findIncidentOrThrow(organizationId, incidentId);

    const events = await this.prisma.incidentEvent.findMany({
      where: { incidentId },
      include: { actor: PERSON },
      orderBy: { createdAt: 'asc' },
    });

    return { data: events.map((event) => this.toEvent(event)) };
  }

  // The raw alerts behind an incident, newest first, with what was sent.
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

    return {
      data: alerts.map((alert) => ({
        id: alert.id,
        dedupKey: alert.dedupKey,
        title: alert.title,
        severity: alert.severity,
        status: alert.status,
        payload: alert.payload,
        receivedAt: alert.receivedAt,
      })),
      meta: this.toMeta(query, total),
    };
  }

  // ---------- Responding (everyone except viewers) ----------

  async acknowledge(
    currentUserId: string,
    organizationId: string,
    incidentId: string,
  ) {
    const user = await this.assertCanRespond(currentUserId, organizationId);
    await this.findIncidentOrThrow(organizationId, incidentId);

    // The important part: "only if it's still TRIGGERED" is inside the
    // update itself. If two people click at the same moment, the database
    // lets exactly one of these updates change the row. Checking the status
    // first and updating after would let both through.
    const result = await this.prisma.incident.updateMany({
      where: { id: incidentId, status: 'TRIGGERED' },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedById: user.id,
      },
    });

    // count 0 means someone else got there first. Tell this caller who.
    if (result.count === 0) {
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
    // TODO (escalation): cancel the pending escalation, and tell everyone
    // watching this incident live.

    return {
      incident: await this.loadFullIncident(organizationId, incidentId),
    };
  }

  async resolve(
    currentUserId: string,
    organizationId: string,
    incidentId: string,
    dto: ResolveIncidentDto,
  ) {
    const user = await this.assertCanRespond(currentUserId, organizationId);
    await this.findIncidentOrThrow(organizationId, incidentId);

    // Same idea as acknowledge: only one caller can move it to RESOLVED.
    const result = await this.prisma.incident.updateMany({
      where: { id: incidentId, status: { in: ['TRIGGERED', 'ACKNOWLEDGED'] } },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: user.id,
      },
    });

    if (result.count === 0) {
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
    // TODO (escalation): cancel the pending escalation here too.

    return {
      incident: await this.loadFullIncident(organizationId, incidentId),
    };
  }

  async addNote(
    currentUserId: string,
    organizationId: string,
    incidentId: string,
    dto: CreateNoteDto,
  ) {
    const user = await this.assertCanRespond(currentUserId, organizationId);
    await this.findIncidentOrThrow(organizationId, incidentId);

    const event = await this.prisma.incidentEvent.create({
      data: {
        incidentId,
        type: 'COMMENT',
        actorType: 'USER',
        actorId: user.id,
        message: dto.message,
      },
      include: { actor: PERSON },
    });

    return this.toEvent(event);
  }

  // ---------- Helpers ----------

  // The role inside the login token can be up to an hour old, so read the
  // real one. Returns the user, whose name goes on the timeline.
  private async assertCanRespond(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: true },
    });

    if (!membership || !canRespond(membership.role)) {
      throw new ForbiddenException('Viewers cannot respond to incidents');
    }

    return { id: membership.user.id, name: membership.user.name };
  }

  // Looking the incident up together with organizationId is what stops one
  // organization from touching another's incidents.
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

  // Called when an acknowledge or resolve changed nothing. Looks at what
  // state the incident is really in and answers 409 with who did it.
  private async throwAlreadyHandled(incidentId: string): Promise<never> {
    const incident = await this.prisma.incident.findUniqueOrThrow({
      where: { id: incidentId },
      include: { acknowledgedBy: PERSON, resolvedBy: PERSON },
    });

    if (incident.status === 'RESOLVED') {
      throw new ConflictException({
        code: 'ALREADY_RESOLVED',
        message: incident.resolvedBy
          ? `Already resolved by ${incident.resolvedBy.name}`
          : 'Already resolved',
        resolvedBy: incident.resolvedBy,
        resolvedAt: incident.resolvedAt,
        status: incident.status,
      });
    }

    throw new ConflictException({
      code: 'ALREADY_ACKNOWLEDGED',
      message: incident.acknowledgedBy
        ? `Already acknowledged by ${incident.acknowledgedBy.name}`
        : 'Already acknowledged',
      acknowledgedBy: incident.acknowledgedBy,
      acknowledgedAt: incident.acknowledgedAt,
      status: incident.status,
    });
  }

  // Everything the incident page shows, in one object.
  private async loadFullIncident(organizationId: string, incidentId: string) {
    const incident = await this.prisma.incident.findUniqueOrThrow({
      where: { id: incidentId },
      include: {
        service: { include: { team: true } },
        acknowledgedBy: PERSON,
        resolvedBy: PERSON,
        _count: { select: { alerts: true } },
      },
    });

    // The policy with each step's target already turned into a name.
    const policy = await this.escalationPoliciesService.getPolicy(
      organizationId,
      incident.service.escalationPolicyId,
    );

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
      alertCount: incident._count.alerts,
      createdAt: incident.createdAt,
      lastAlertAt: incident.lastAlertAt,
      acknowledgedBy: incident.acknowledgedBy,
      acknowledgedAt: incident.acknowledgedAt,
      resolvedBy: incident.resolvedBy,
      resolvedAt: incident.resolvedAt,
      escalation: {
        policy: { id: policy.id, name: policy.name },
        currentStepPosition: incident.currentStepPosition,
        round: incident.escalationRound,
        repeatCount: policy.repeatCount,
        // TODO (escalation): nobody is notified yet, so there's no next
        // escalation time and every step is still "pending". Once the
        // escalation worker exists it fills these in.
        nextEscalationAt: null as Date | null,
        steps: policy.steps.map((step) => ({
          position: step.position,
          delayMinutes: step.delayMinutes,
          targetType: step.targetType,
          targetName: step.target.name,
          state: 'pending',
          notifiedUsers: [] as { name: string; at: Date; status: string }[],
        })),
      },
    };
  }

  private toEvent(event: {
    id: string;
    type: string;
    actorType: string;
    actor: { id: string; name: string } | null;
    message: string;
    metadata: unknown;
    createdAt: Date;
  }) {
    return {
      id: event.id,
      type: event.type,
      actorType: event.actorType,
      actor: event.actor,
      message: event.message,
      metadata: event.metadata ?? null,
      createdAt: event.createdAt,
    };
  }

  private toMeta(query: PaginationDto, total: number) {
    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
