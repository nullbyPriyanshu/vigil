import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashToken } from 'src/auth/utils/tokens';
import { IncidentsService } from 'src/incidents/incidents.service';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ActionLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidentsService: IncidentsService,
    private readonly configService: ConfigService,
  ) {}

  async getAction(token: string) {
    const actionToken = await this.findUsableToken(token);

    return {
      action: actionToken.action,
      incident: {
        number: actionToken.incident.number,
        title: actionToken.incident.title,
        severity: actionToken.incident.severity,
        status: actionToken.incident.status,
        service: actionToken.incident.service.name,
      },
      user: { name: actionToken.user.name },
      expiresAt: actionToken.expiresAt,
    };
  }

  async performAction(token: string) {
    const actionToken = await this.findUsableToken(token);
    const incident = actionToken.incident;

    let status = '';

    if (actionToken.action === 'ACKNOWLEDGE') {
      const result = await this.incidentsService.acknowledge(
        actionToken.userId,
        incident.organizationId,
        incident.id,
      );
      status = result.incident.status;
    } else {
      const result = await this.incidentsService.resolve(
        actionToken.userId,
        incident.organizationId,
        incident.id,
        {},
      );
      status = result.incident.status;
    }

    await this.prisma.actionToken.update({
      where: { id: actionToken.id },
      data: { usedAt: new Date() },
    });

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    return {
      action: actionToken.action,
      incident: { number: incident.number, status },
      dashboardUrl: `${frontendUrl}/incidents/${incident.number}`,
    };
  }

  private async findUsableToken(token: string) {
    const actionToken = await this.prisma.actionToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true, incident: { include: { service: true } } },
    });

    if (!actionToken) {
      throw new NotFoundException('This link is not valid');
    }
    if (actionToken.usedAt) {
      throw new GoneException('This link has already been used');
    }
    if (actionToken.expiresAt <= new Date()) {
      throw new GoneException('This link has expired');
    }

    return actionToken;
  }
}
