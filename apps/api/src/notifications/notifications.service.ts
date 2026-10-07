import { Injectable, Logger } from '@nestjs/common';
import { generateToken, hashToken } from 'src/auth/utils/tokens';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma.service';
import { SchedulesService } from 'src/schedules/schedules.service';

const ACTION_LINK_TTL_MS = 24 * 60 * 60 * 1000;

type Person = { id: string; name: string; email: string };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly schedulesService: SchedulesService,
  ) {}

  async notifyStep(incidentId: string, stepPosition: number) {
    try {
      const incident = await this.prisma.incident.findUnique({
        where: { id: incidentId },
        include: {
          service: {
            include: { escalationPolicy: { include: { steps: true } } },
          },
        },
      });
      if (!incident) {
        return;
      }

      const step = incident.service.escalationPolicy.steps.find(
        (s) => s.position === stepPosition,
      );
      if (!step) {
        return;
      }

      let people: Person[] = [];

      if (step.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: step.userId },
        });
        if (user) people = [user];
      }

      if (step.teamId) {
        const memberships = await this.prisma.membership.findMany({
          where: {
            organizationId: incident.organizationId,
            role: { not: 'VIEWER' },
            user: { teamMemberships: { some: { teamId: step.teamId } } },
          },
          include: { user: true },
        });
        people = memberships.map((membership) => membership.user);
      }

      if (step.scheduleId) {
        const user = await this.schedulesService.findOnCallUser(
          step.scheduleId,
        );
        if (user) {
          people = [user];
        } else {
          people = await this.findAdmins(incident.organizationId);
          await this.prisma.incidentEvent.create({
            data: {
              incidentId: incident.id,
              type: 'ESCALATED',
              actorType: 'SYSTEM',
              message:
                'Nobody is on call for this schedule. Notifying the admins instead',
            },
          });
        }
      }

      for (const person of people) {
        await this.sendIncidentEmail(incident, person, step.position);
      }
    } catch (error) {
      this.logger.error(`Could not notify for incident ${incidentId}`, error);
    }
  }

  private async findAdmins(organizationId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId, role: { in: ['OWNER', 'ADMIN'] } },
      include: { user: true },
    });
    return memberships.map((membership) => membership.user);
  }

  private async sendIncidentEmail(
    incident: {
      id: string;
      number: number;
      title: string;
      severity: string;
      service: { name: string };
    },
    person: Person,
    stepPosition: number,
  ) {
    const acknowledgeToken = generateToken();
    const resolveToken = generateToken();
    const expiresAt = new Date(Date.now() + ACTION_LINK_TTL_MS);

    await this.prisma.actionToken.createMany({
      data: [
        {
          tokenHash: hashToken(acknowledgeToken),
          action: 'ACKNOWLEDGE',
          incidentId: incident.id,
          userId: person.id,
          expiresAt,
        },
        {
          tokenHash: hashToken(resolveToken),
          action: 'RESOLVE',
          incidentId: incident.id,
          userId: person.id,
          expiresAt,
        },
      ],
    });

    let providerMessageId: string | null = null;
    let sent = true;

    try {
      const email = await this.mailService.sendIncidentEmail(person.email, {
        name: person.name,
        incidentNumber: incident.number,
        title: incident.title,
        severity: incident.severity,
        serviceName: incident.service.name,
        acknowledgeToken,
        resolveToken,
      });
      providerMessageId = email ? email.id : null;
    } catch {
      sent = false;
    }

    const notification = await this.prisma.notification.create({
      data: {
        incidentId: incident.id,
        userId: person.id,
        stepPosition,
        status: sent ? 'SENT' : 'FAILED',
        providerMessageId,
      },
    });

    await this.prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: sent ? 'NOTIFICATION_SENT' : 'NOTIFICATION_FAILED',
        actorType: 'SYSTEM',
        message: sent
          ? `Email sent to ${person.name}`
          : `Email to ${person.name} could not be sent`,
        metadata: {
          notificationId: notification.id,
          status: notification.status,
        },
      },
    });
  }
}
