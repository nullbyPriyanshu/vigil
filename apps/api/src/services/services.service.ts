import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertsService } from 'src/alerts/alerts.service';
import { Severity } from 'src/generated/prisma/enums';
import { MembersService } from 'src/members/members.service';
import { PrismaService } from 'src/prisma.service';
import { CreateServiceDto } from './dto/createService.dto';
import { UpdateServiceDto } from './dto/updateService.dto';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
    private readonly alertsService: AlertsService,
  ) {}

  async listServices(organizationId: string) {
    const services = await this.prisma.service.findMany({
      where: { organizationId },
      include: { team: true, escalationPolicy: true },
      orderBy: { name: 'asc' },
    });

    const openIncidents = await this.prisma.incident.findMany({
      where: { organizationId, status: { not: 'RESOLVED' } },
    });

    const data = services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      team: { id: service.team.id, name: service.team.name },
      escalationPolicy: {
        id: service.escalationPolicy.id,
        name: service.escalationPolicy.name,
      },
      autoResolveMinutes: service.autoResolveMinutes,
      openIncidentCount: openIncidents.filter(
        (incident) => incident.serviceId === service.id,
      ).length,
      createdAt: service.createdAt,
    }));

    return { data };
  }

  async getService(organizationId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, organizationId },
      include: { team: true, escalationPolicy: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const openIncidentCount = await this.prisma.incident.count({
      where: { serviceId: service.id, status: { not: 'RESOLVED' } },
    });

    const alerts = await this.prisma.alert.findMany({
      where: { serviceId: service.id },
      include: { incident: true },
      orderBy: { receivedAt: 'desc' },
      take: 20,
    });

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
      openIncidentCount,
      createdAt: service.createdAt,
      recentAlerts: alerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        receivedAt: alert.receivedAt,
        incidentNumber: alert.incident ? alert.incident.number : null,
        kind: alert.deduplicated ? 'dedup' : 'new',
      })),
    };
  }

  async createService(
    userId: string,
    organizationId: string,
    dto: CreateServiceDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    await this.checkTeam(organizationId, dto.teamId);
    await this.checkPolicy(organizationId, dto.escalationPolicyId);
    await this.checkNameIsFree(organizationId, dto.name);

    const service = await this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        autoResolveMinutes: dto.autoResolveMinutes ?? null,
        organizationId,
        teamId: dto.teamId,
        escalationPolicyId: dto.escalationPolicyId,
      },
    });

    return this.getService(organizationId, service.id);
  }

  async updateService(
    userId: string,
    organizationId: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const service = await this.getService(organizationId, serviceId);

    if (dto.teamId) {
      await this.checkTeam(organizationId, dto.teamId);
    }
    if (dto.escalationPolicyId) {
      await this.checkPolicy(organizationId, dto.escalationPolicyId);
    }
    if (dto.name && dto.name !== service.name) {
      await this.checkNameIsFree(organizationId, dto.name, service.id);
    }

    await this.prisma.service.update({
      where: { id: service.id },
      data: {
        name: dto.name,
        description: dto.description,
        autoResolveMinutes: dto.autoResolveMinutes,
        teamId: dto.teamId,
        escalationPolicyId: dto.escalationPolicyId,
      },
    });

    return this.getService(organizationId, service.id);
  }

  async deleteService(
    userId: string,
    organizationId: string,
    serviceId: string,
  ) {
    await this.membersService.assertCanManageMembers(userId, organizationId);
    const service = await this.getService(organizationId, serviceId);

    const openIncidents = await this.prisma.incident.findMany({
      where: { serviceId: service.id, status: { not: 'RESOLVED' } },
      orderBy: { number: 'asc' },
    });

    if (openIncidents.length > 0) {
      const word = openIncidents.length === 1 ? 'incident' : 'incidents';
      throw new ConflictException({
        message: `Service has ${openIncidents.length} open ${word}`,
        incidents: openIncidents.map((incident) => ({
          id: incident.id,
          number: incident.number,
          name: `INC-${incident.number}`,
        })),
      });
    }

    await this.prisma.service.delete({ where: { id: service.id } });
  }

  async sendTestAlert(
    userId: string,
    organizationId: string,
    serviceId: string,
    severity: Severity,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership || membership.role === 'VIEWER') {
      throw new ForbiddenException('Viewers cannot send test alerts');
    }

    const service = await this.getService(organizationId, serviceId);

    const alert = {
      title: `Test alert for ${service.name}`,
      dedup_key: 'vigil-test-alert',
      severity: severity.toLowerCase() as 'critical' | 'high' | 'low',
      description: 'Sent from the Vigil dashboard to check the setup works',
    };

    const result = await this.alertsService.createAlert(
      { serviceId: service.id, organizationId },
      alert,
      { ...alert, source: 'test-alert' },
    );

    return {
      alertId: result.body.alert_id,
      incidentId: result.body.incident_id,
      incidentNumber: result.body.incident_number,
      deduplicated: !result.created,
    };
  }

  private async checkTeam(organizationId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });
    if (!team) {
      throw new BadRequestException('Team not found in your organization');
    }
  }

  private async checkPolicy(organizationId: string, policyId: string) {
    const policy = await this.prisma.escalationPolicy.findFirst({
      where: { id: policyId, organizationId },
    });
    if (!policy) {
      throw new BadRequestException(
        'Escalation policy not found in your organization',
      );
    }
  }

  private async checkNameIsFree(
    organizationId: string,
    name: string,
    ignoreServiceId?: string,
  ) {
    const existing = await this.prisma.service.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: 'insensitive' },
        id: { not: ignoreServiceId },
      },
    });
    if (existing) {
      throw new ConflictException(`A service named "${name}" already exists`);
    }
  }
}
