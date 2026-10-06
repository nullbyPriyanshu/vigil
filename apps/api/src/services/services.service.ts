import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { CreateServiceDto } from './dto/createService.dto';
import { UpdateServiceDto } from './dto/updateService.dto';

type ServiceWithRelations = {
  id: string;
  name: string;
  description: string | null;
  autoResolveMinutes: number | null;
  createdAt: Date;
  team: { id: string; name: string };
  escalationPolicy: { id: string; name: string };
  _count: { incidents: number };
};

// What every query loads alongside a service. The count is of incidents
// that are still open (not resolved).
const WITH_RELATIONS = {
  team: true,
  escalationPolicy: true,
  _count: {
    select: { incidents: { where: { status: { not: 'RESOLVED' } } } },
  },
} as const;

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  // ---------- Reading (any role) ----------

  async listServices(organizationId: string) {
    const services = await this.prisma.service.findMany({
      where: { organizationId },
      include: WITH_RELATIONS,
      orderBy: { name: 'asc' },
    });

    return { data: services.map((service) => this.toService(service)) };
  }

  async getService(organizationId: string, serviceId: string) {
    const service = await this.findServiceOrThrow(organizationId, serviceId);

    // The 20 most recent alerts, each marked as having opened a new
    // incident ("new") or joined one that was already open ("dedup").
    const alerts = await this.prisma.alert.findMany({
      where: { serviceId: service.id },
      include: { incident: true },
      orderBy: { receivedAt: 'desc' },
      take: 20,
    });

    return {
      ...this.toService(service),
      recentAlerts: alerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        receivedAt: alert.receivedAt,
        incidentNumber: alert.incident?.number ?? null,
        kind: alert.deduplicated ? ('dedup' as const) : ('new' as const),
      })),
    };
  }

  // ---------- Changing (owners and admins) ----------

  async createService(
    currentUserId: string,
    organizationId: string,
    dto: CreateServiceDto,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );

    await this.assertTeamInOrganization(organizationId, dto.teamId);
    await this.assertPolicyInOrganization(
      organizationId,
      dto.escalationPolicyId,
    );
    await this.assertNameIsFree(organizationId, dto.name);

    const service = await this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        autoResolveMinutes: dto.autoResolveMinutes ?? null,
        organizationId,
        teamId: dto.teamId,
        escalationPolicyId: dto.escalationPolicyId,
      },
      include: WITH_RELATIONS,
    });

    return this.toService(service);
  }

  async updateService(
    currentUserId: string,
    organizationId: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
    const service = await this.findServiceOrThrow(organizationId, serviceId);

    // The same checks as creating, but only for the fields being changed.
    if (dto.teamId !== undefined) {
      await this.assertTeamInOrganization(organizationId, dto.teamId);
    }
    if (dto.escalationPolicyId !== undefined) {
      await this.assertPolicyInOrganization(
        organizationId,
        dto.escalationPolicyId,
      );
    }
    if (dto.name !== undefined && dto.name !== service.name) {
      await this.assertNameIsFree(organizationId, dto.name, service.id);
    }

    // Prisma leaves a column alone when it's given `undefined`, so fields
    // that weren't sent stay as they are. `null` is different: it clears
    // the description or turns auto-resolve off.
    const updated = await this.prisma.service.update({
      where: { id: service.id },
      data: {
        name: dto.name,
        description: dto.description,
        autoResolveMinutes: dto.autoResolveMinutes,
        teamId: dto.teamId,
        escalationPolicyId: dto.escalationPolicyId,
      },
      include: WITH_RELATIONS,
    });

    return this.toService(updated);
  }

  async deleteService(
    currentUserId: string,
    organizationId: string,
    serviceId: string,
  ) {
    await this.membersService.assertCanManageMembers(
      currentUserId,
      organizationId,
    );
    const service = await this.findServiceOrThrow(organizationId, serviceId);

    // Refuse while people are still working on its incidents.
    const openIncidents = await this.prisma.incident.findMany({
      where: { serviceId: service.id, status: { not: 'RESOLVED' } },
      select: { id: true, number: true },
      orderBy: { number: 'asc' },
    });
    if (openIncidents.length > 0) {
      throw new ConflictException({
        message: `Service has ${openIncidents.length} open ${openIncidents.length === 1 ? 'incident' : 'incidents'}`,
        incidents: openIncidents.map((incident) => ({
          id: incident.id,
          number: incident.number,
          name: `INC-${incident.number}`,
        })),
      });
    }

    // Its API keys, alerts and resolved incidents go with it (onDelete:
    // Cascade in the schema), so its keys stop working straight away.
    await this.prisma.service.delete({ where: { id: service.id } });
  }

  // ---------- Helpers ----------

  // Looking the service up together with organizationId is what stops one
  // organization from reading or changing another's services.
  private async findServiceOrThrow(organizationId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, organizationId },
      include: WITH_RELATIONS,
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  // A team or policy id from another organization is treated exactly like
  // one that doesn't exist: a plain 400, with no hint that it's real.
  private async assertTeamInOrganization(
    organizationId: string,
    teamId: string,
  ) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });
    if (!team) {
      throw new BadRequestException('Team not found in your organization');
    }
  }

  private async assertPolicyInOrganization(
    organizationId: string,
    policyId: string,
  ) {
    const policy = await this.prisma.escalationPolicy.findFirst({
      where: { id: policyId, organizationId },
    });
    if (!policy) {
      throw new BadRequestException(
        'Escalation policy not found in your organization',
      );
    }
  }

  // Names are compared ignoring case, so "Checkout API" and "checkout api"
  // can't both exist. `ignoreId` is the service being renamed, so it doesn't
  // clash with itself.
  private async assertNameIsFree(
    organizationId: string,
    name: string,
    ignoreId?: string,
  ) {
    const taken = await this.prisma.service.count({
      where: {
        organizationId,
        name: { equals: name, mode: 'insensitive' },
        id: { not: ignoreId },
      },
    });
    if (taken > 0) {
      throw new ConflictException(`A service named "${name}" already exists`);
    }
  }

  private toService(service: ServiceWithRelations) {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      team: { id: service.team.id, name: service.team.name },
      escalationPolicy: {
        id: service.escalationPolicy.id,
        name: service.escalationPolicy.name,
      },
      autoResolveMinutes: service.autoResolveMinutes,
      openIncidentCount: service._count.incidents,
      createdAt: service.createdAt,
    };
  }
}
