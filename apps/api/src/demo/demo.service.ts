import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { getFirstHandoff } from 'src/schedules/onCall';
import { DEMO_INCIDENTS } from './demoIncidents';

const ONE_MINUTE = 60 * 1000;
const ONE_DAY = 24 * 60 * ONE_MINUTE;

@Injectable()
export class DemoService {
  constructor(private readonly prisma: PrismaService) {}

  async seed(userId: string, organizationId: string) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_DEMO_SEED !== 'true'
    ) {
      throw new ForbiddenException('Demo data is turned off here');
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: true },
    });
    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException('Only the owner can load demo data');
    }
    const owner = membership.user;

    const teamCount = await this.prisma.team.count({
      where: { organizationId },
    });
    const policyCount = await this.prisma.escalationPolicy.count({
      where: { organizationId },
    });
    const incidentCount = await this.prisma.incident.count({
      where: { organizationId },
    });
    if (teamCount + policyCount + incidentCount > 0) {
      throw new ConflictException('Organization already has data');
    }

    const responders = await this.prisma.membership.findMany({
      where: { organizationId, role: { not: 'VIEWER' } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    const people = responders.map((responder) => responder.user);

    const platformTeam = await this.prisma.team.create({
      data: {
        name: 'Platform Team',
        slug: 'platform-team',
        organizationId,
        members: { create: people.map((person) => ({ userId: person.id })) },
      },
    });
    const paymentsTeam = await this.prisma.team.create({
      data: {
        name: 'Payments Team',
        slug: 'payments-team',
        organizationId,
        members: { create: [{ userId: owner.id }] },
      },
    });

    const fourWeeksAgo = new Date(Date.now() - 28 * ONE_DAY)
      .toISOString()
      .slice(0, 10);
    const schedule = await this.prisma.schedule.create({
      data: {
        name: 'Platform Weekly',
        timezone: owner.timezone,
        rotationType: 'WEEKLY',
        handoffDay: 1,
        handoffTime: '10:00',
        startDate: getFirstHandoff(
          fourWeeksAgo,
          '10:00',
          owner.timezone,
          'WEEKLY',
          1,
        ),
        organizationId,
        teamId: platformTeam.id,
        participants: {
          create: people.map((person, index) => ({
            userId: person.id,
            position: index,
          })),
        },
      },
    });

    const platformPolicy = await this.prisma.escalationPolicy.create({
      data: {
        name: 'Platform Critical',
        repeatCount: 1,
        organizationId,
        steps: {
          create: [
            {
              position: 1,
              delayMinutes: 5,
              targetType: 'SCHEDULE',
              scheduleId: schedule.id,
            },
            {
              position: 2,
              delayMinutes: 10,
              targetType: 'TEAM',
              teamId: platformTeam.id,
            },
          ],
        },
      },
    });
    const paymentsPolicy = await this.prisma.escalationPolicy.create({
      data: {
        name: 'Payments Standard',
        organizationId,
        steps: {
          create: [
            {
              position: 1,
              delayMinutes: 15,
              targetType: 'USER',
              userId: owner.id,
            },
          ],
        },
      },
    });

    const checkout = await this.prisma.service.create({
      data: {
        name: 'Checkout API',
        description: 'Cart, orders and the checkout page',
        organizationId,
        teamId: platformTeam.id,
        escalationPolicyId: platformPolicy.id,
      },
    });
    const auth = await this.prisma.service.create({
      data: {
        name: 'Auth Service',
        description: 'Login, signup and sessions',
        organizationId,
        teamId: platformTeam.id,
        escalationPolicyId: platformPolicy.id,
      },
    });
    const payments = await this.prisma.service.create({
      data: {
        name: 'Payments API',
        description: 'Card payments, refunds and payouts',
        organizationId,
        teamId: paymentsTeam.id,
        escalationPolicyId: paymentsPolicy.id,
      },
    });

    const serviceIds = {
      'Checkout API': checkout.id,
      'Auth Service': auth.id,
      'Payments API': payments.id,
    };

    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { incidentCounter: { increment: DEMO_INCIDENTS.length } },
    });
    const firstNumber =
      organization.incidentCounter - DEMO_INCIDENTS.length + 1;

    for (let i = 0; i < DEMO_INCIDENTS.length; i++) {
      const demo = DEMO_INCIDENTS[i];
      const person = people[i % people.length];

      let createdAt = new Date(
        Date.now() - demo.daysAgo * ONE_DAY - ((i * 97) % 600) * ONE_MINUTE,
      );
      if (demo.daysAgo === 0) {
        createdAt = new Date(Date.now() - (30 - i) * 4 * ONE_MINUTE);
      }

      const acknowledgedAt =
        demo.minutesToAcknowledge === null
          ? null
          : new Date(
              createdAt.getTime() + demo.minutesToAcknowledge * ONE_MINUTE,
            );
      const resolvedAt =
        demo.minutesToResolve === null
          ? null
          : new Date(createdAt.getTime() + demo.minutesToResolve * ONE_MINUTE);

      let status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED' = 'TRIGGERED';
      if (acknowledgedAt) status = 'ACKNOWLEDGED';
      if (resolvedAt) status = 'RESOLVED';

      const dedupKey = `demo-${i + 1}`;

      const alerts: Prisma.AlertCreateManyIncidentInput[] = [];
      for (let a = 0; a < demo.alerts; a++) {
        alerts.push({
          title: demo.title,
          severity: demo.severity,
          status: 'TRIGGERED',
          dedupKey,
          payload: { title: demo.title, dedup_key: dedupKey, source: 'demo' },
          deduplicated: a > 0,
          receivedAt: new Date(createdAt.getTime() + a * 2 * ONE_MINUTE),
          serviceId: serviceIds[demo.service],
        });
      }

      const events: Prisma.IncidentEventCreateManyIncidentInput[] = [
        {
          type: 'CREATED',
          actorType: 'INTEGRATION',
          message: 'Incident created from alert',
          createdAt,
        },
      ];
      if (acknowledgedAt) {
        events.push({
          type: 'ACKNOWLEDGED',
          actorType: 'USER',
          actorId: person.id,
          message: `Acknowledged by ${person.name}`,
          createdAt: acknowledgedAt,
        });
      }
      if (resolvedAt) {
        events.push({
          type: 'RESOLVED',
          actorType: 'USER',
          actorId: person.id,
          message: `Resolved by ${person.name}`,
          createdAt: resolvedAt,
        });
      }

      await this.prisma.incident.create({
        data: {
          number: firstNumber + i,
          title: demo.title,
          severity: demo.severity,
          status,
          dedupKey,
          createdAt,
          lastAlertAt: new Date(
            createdAt.getTime() + (demo.alerts - 1) * 2 * ONE_MINUTE,
          ),
          acknowledgedAt,
          acknowledgedById: acknowledgedAt ? person.id : null,
          resolvedAt,
          resolvedById: resolvedAt ? person.id : null,
          currentStepPosition: i % 5 === 0 ? 2 : 1,
          organizationId,
          serviceId: serviceIds[demo.service],
          alerts: { createMany: { data: alerts } },
          events: { createMany: { data: events } },
        },
      });
    }

    return {
      teams: 2,
      services: 3,
      schedules: 1,
      escalationPolicies: 2,
      incidents: DEMO_INCIDENTS.length,
    };
  }
}
