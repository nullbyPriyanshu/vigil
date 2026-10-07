import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { getFirstHandoff } from '../src/schedules/onCall';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

const ORG_NAME = 'Acme Corp';
const ORG_SLUG = 'acme-corp';
const PASSWORD = 'Vigil@12345';
const TIMEZONE = 'Asia/Kolkata';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const PEOPLE = [
  { key: 'aarav', name: 'Aarav Mehta', role: 'OWNER' },
  { key: 'rahul', name: 'Rahul Verma', role: 'ADMIN' },
  { key: 'sneha', name: 'Sneha Kapoor', role: 'RESPONDER' },
  { key: 'amit', name: 'Amit Sharma', role: 'RESPONDER' },
  { key: 'maya', name: 'Maya Chen', role: 'RESPONDER' },
  { key: 'daniel', name: 'Daniel Okafor', role: 'RESPONDER' },
  { key: 'zara', name: 'Zara Khan', role: 'VIEWER' },
] as const;

function emailFor(key: string) {
  return `delivered+${key}@resend.dev`;
}

const TEAMS = [
  { name: 'Platform Team', slug: 'platform-team', members: ['aarav', 'rahul', 'sneha', 'amit'] },
  { name: 'Payments Team', slug: 'payments-team', members: ['rahul', 'maya', 'daniel'] },
  { name: 'Infrastructure', slug: 'infrastructure', members: ['aarav', 'amit', 'daniel', 'zara'] },
];

const SERVICES = [
  { name: 'Checkout API', description: 'Cart, orders and the checkout page', team: 'Platform Team', policy: 'Platform Critical', autoResolveMinutes: null },
  { name: 'Auth Service', description: 'Login, signup and sessions', team: 'Platform Team', policy: 'Platform Critical', autoResolveMinutes: null },
  { name: 'Search API', description: 'Product search and suggestions', team: 'Platform Team', policy: 'Platform Critical', autoResolveMinutes: 60 },
  { name: 'Payments API', description: 'Card payments, refunds and payouts', team: 'Payments Team', policy: 'Payments Standard', autoResolveMinutes: null },
  { name: 'Billing Worker', description: 'Invoices and subscription renewals', team: 'Payments Team', policy: 'Payments Standard', autoResolveMinutes: 120 },
  { name: 'Postgres Primary', description: 'The main database cluster', team: 'Infrastructure', policy: 'Infrastructure Default', autoResolveMinutes: null },
  { name: 'CDN Edge', description: 'Static assets and image delivery', team: 'Infrastructure', policy: 'Infrastructure Default', autoResolveMinutes: 30 },
];

const PROBLEMS = [
  { title: 'Database connection pool exhausted', service: 'Checkout API', severity: 'CRITICAL' },
  { title: 'Elevated 5xx rate on /api/orders', service: 'Checkout API', severity: 'HIGH' },
  { title: 'Cart service memory climbing', service: 'Checkout API', severity: 'LOW' },
  { title: 'Checkout page error rate above 5%', service: 'Checkout API', severity: 'CRITICAL' },
  { title: 'Login latency above 2s', service: 'Auth Service', severity: 'HIGH' },
  { title: 'Token refresh failures', service: 'Auth Service', severity: 'CRITICAL' },
  { title: 'Password reset emails delayed', service: 'Auth Service', severity: 'LOW' },
  { title: 'Search results timing out', service: 'Search API', severity: 'HIGH' },
  { title: 'Search index is stale', service: 'Search API', severity: 'LOW' },
  { title: 'Payment webhook timeout', service: 'Payments API', severity: 'HIGH' },
  { title: 'Card processor returning 503', service: 'Payments API', severity: 'CRITICAL' },
  { title: 'Duplicate charge reports', service: 'Payments API', severity: 'CRITICAL' },
  { title: 'Refund queue backlog', service: 'Billing Worker', severity: 'HIGH' },
  { title: 'Invoice generation job failed', service: 'Billing Worker', severity: 'LOW' },
  { title: 'Replication lag above 30s', service: 'Postgres Primary', severity: 'HIGH' },
  { title: 'Disk usage above 85%', service: 'Postgres Primary', severity: 'HIGH' },
  { title: 'Slow queries on orders table', service: 'Postgres Primary', severity: 'LOW' },
  { title: 'Cache hit rate dropped below 60%', service: 'CDN Edge', severity: 'LOW' },
  { title: 'Certificate expires in 7 days', service: 'CDN Edge', severity: 'LOW' },
] as const;

const COMMENTS = [
  'Looking into it now.',
  'Restarted the pool, watching the graphs.',
  'Rolled back the last deploy.',
  'Caused by a slow query. Added an index.',
  'Upstream provider confirmed an outage on their side.',
  'Scaled the workers from 4 to 8.',
];

function hashApiKey(key: string) {
  return createHash('sha256')
    .update(key + (process.env.API_KEY_PEPPER ?? ''))
    .digest('hex');
}

async function removeOldSeed() {
  const organization = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
  });

  if (organization) {
    const organizationId = organization.id;
    await prisma.service.deleteMany({ where: { organizationId } });
    await prisma.escalationPolicy.deleteMany({ where: { organizationId } });
    await prisma.schedule.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
  }

  await prisma.user.deleteMany({
    where: { email: { in: PEOPLE.map((person) => emailFor(person.key)) } },
  });
}

async function main() {
  await removeOldSeed();

  const now = Date.now();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const organization = await prisma.organization.create({
    data: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      onboardingCompletedAt: new Date(now - 90 * DAY),
      createdAt: new Date(now - 90 * DAY),
    },
  });
  const organizationId = organization.id;

  const users: Record<string, { id: string; name: string }> = {};
  for (const person of PEOPLE) {
    const user = await prisma.user.create({
      data: {
        name: person.name,
        email: emailFor(person.key),
        passwordHash,
        timezone: TIMEZONE,
        createdAt: new Date(now - 90 * DAY),
        memberships: {
          create: {
            organizationId,
            role: person.role,
            createdAt: new Date(now - 90 * DAY),
          },
        },
      },
    });
    users[person.key] = { id: user.id, name: user.name };
  }

  await prisma.invitation.createMany({
    data: [
      {
        email: 'delivered+priya@resend.dev',
        role: 'RESPONDER',
        tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
        expiresAt: new Date(now + 6 * DAY),
        organizationId,
        invitedById: users.aarav.id,
      },
      {
        email: 'delivered+omar@resend.dev',
        role: 'VIEWER',
        tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
        expiresAt: new Date(now + 3 * DAY),
        organizationId,
        invitedById: users.rahul.id,
      },
    ],
  });

  const teams: Record<string, string> = {};
  for (const team of TEAMS) {
    const created = await prisma.team.create({
      data: {
        name: team.name,
        slug: team.slug,
        organizationId,
        members: { create: team.members.map((key) => ({ userId: users[key].id })) },
      },
    });
    teams[team.name] = created.id;
  }

  const startDate = new Date(now - 56 * DAY).toISOString().slice(0, 10);

  const platformWeekly = await prisma.schedule.create({
    data: {
      name: 'Platform Weekly',
      timezone: TIMEZONE,
      rotationType: 'WEEKLY',
      handoffDay: 1,
      handoffTime: '10:00',
      startDate: getFirstHandoff(startDate, '10:00', TIMEZONE, 'WEEKLY', 1),
      organizationId,
      teamId: teams['Platform Team'],
      participants: {
        create: ['aarav', 'rahul', 'sneha', 'amit'].map((key, position) => ({
          userId: users[key].id,
          position,
        })),
      },
    },
  });
  const paymentsDaily = await prisma.schedule.create({
    data: {
      name: 'Payments Daily',
      timezone: 'Europe/London',
      rotationType: 'DAILY',
      handoffDay: null,
      handoffTime: '09:00',
      startDate: getFirstHandoff(startDate, '09:00', 'Europe/London', 'DAILY', null),
      organizationId,
      teamId: teams['Payments Team'],
      participants: {
        create: ['maya', 'daniel', 'rahul'].map((key, position) => ({
          userId: users[key].id,
          position,
        })),
      },
    },
  });
  const infraWeekly = await prisma.schedule.create({
    data: {
      name: 'Infrastructure Weekly',
      timezone: 'America/New_York',
      rotationType: 'WEEKLY',
      handoffDay: 5,
      handoffTime: '17:00',
      startDate: getFirstHandoff(startDate, '17:00', 'America/New_York', 'WEEKLY', 5),
      organizationId,
      teamId: teams['Infrastructure'],
      participants: {
        create: ['amit', 'daniel', 'aarav'].map((key, position) => ({
          userId: users[key].id,
          position,
        })),
      },
    },
  });

  const policies: Record<string, { id: string; steps: number; responders: string[] }> = {};

  const platformPolicy = await prisma.escalationPolicy.create({
    data: {
      name: 'Platform Critical',
      repeatCount: 1,
      organizationId,
      steps: {
        create: [
          { position: 1, delayMinutes: 5, targetType: 'SCHEDULE', scheduleId: platformWeekly.id },
          { position: 2, delayMinutes: 10, targetType: 'USER', userId: users.rahul.id },
          { position: 3, delayMinutes: 15, targetType: 'TEAM', teamId: teams['Platform Team'] },
        ],
      },
    },
  });
  policies['Platform Critical'] = { id: platformPolicy.id, steps: 3, responders: ['aarav', 'rahul', 'sneha', 'amit'] };

  const paymentsPolicy = await prisma.escalationPolicy.create({
    data: {
      name: 'Payments Standard',
      repeatCount: 0,
      organizationId,
      steps: {
        create: [
          { position: 1, delayMinutes: 10, targetType: 'SCHEDULE', scheduleId: paymentsDaily.id },
          { position: 2, delayMinutes: 20, targetType: 'TEAM', teamId: teams['Payments Team'] },
        ],
      },
    },
  });
  policies['Payments Standard'] = { id: paymentsPolicy.id, steps: 2, responders: ['maya', 'daniel', 'rahul'] };

  const infraPolicy = await prisma.escalationPolicy.create({
    data: {
      name: 'Infrastructure Default',
      repeatCount: 2,
      organizationId,
      steps: {
        create: [
          { position: 1, delayMinutes: 15, targetType: 'SCHEDULE', scheduleId: infraWeekly.id },
          { position: 2, delayMinutes: 30, targetType: 'USER', userId: users.aarav.id },
        ],
      },
    },
  });
  policies['Infrastructure Default'] = { id: infraPolicy.id, steps: 2, responders: ['amit', 'daniel', 'aarav'] };

  const services: Record<string, { id: string; policy: string }> = {};
  const apiKeys: { service: string; key: string }[] = [];

  for (const service of SERVICES) {
    const created = await prisma.service.create({
      data: {
        name: service.name,
        description: service.description,
        autoResolveMinutes: service.autoResolveMinutes,
        organizationId,
        teamId: teams[service.team],
        escalationPolicyId: policies[service.policy].id,
        createdAt: new Date(now - 85 * DAY),
      },
    });
    services[service.name] = { id: created.id, policy: service.policy };

    const random = randomBytes(24).toString('hex');
    const key = `vgl_live_${random}`;
    await prisma.apiKey.create({
      data: {
        name: 'Production monitoring',
        prefix: random.slice(0, 8),
        keyHash: hashApiKey(key),
        lastUsedAt: new Date(now - 12 * MINUTE),
        serviceId: created.id,
        createdAt: new Date(now - 80 * DAY),
      },
    });
    apiKeys.push({ service: service.name, key });
  }

  const oldRandom = randomBytes(24).toString('hex');
  await prisma.apiKey.create({
    data: {
      name: 'Old staging key',
      prefix: oldRandom.slice(0, 8),
      keyHash: hashApiKey(`vgl_live_${oldRandom}`),
      lastUsedAt: new Date(now - 40 * DAY),
      revokedAt: new Date(now - 30 * DAY),
      serviceId: services['Checkout API'].id,
      createdAt: new Date(now - 70 * DAY),
    },
  });

  const INCIDENT_COUNT = 84;
  const OPEN_TRIGGERED = 2;
  const OPEN_ACKNOWLEDGED = 2;
  let notificationCount = 0;

  for (let i = 0; i < INCIDENT_COUNT; i++) {
    const number = i + 1;
    const problem = PROBLEMS[(i * 7) % PROBLEMS.length];
    const service = services[problem.service];
    const policy = policies[service.policy];
    const responders = policy.responders.map((key) => users[key]);
    const firstResponder = responders[i % responders.length];
    const resolver = responders[(i + 1) % responders.length];

    const fromEnd = INCIDENT_COUNT - 1 - i;
    const isTriggered = fromEnd < OPEN_TRIGGERED;
    const isAcknowledged = !isTriggered && fromEnd < OPEN_TRIGGERED + OPEN_ACKNOWLEDGED;

    const closedCount = INCIDENT_COUNT - OPEN_TRIGGERED - OPEN_ACKNOWLEDGED;
    const age = Math.pow((closedCount - 1 - i) / (closedCount - 1), 1.7);
    let createdAt = new Date(now - (0.3 + 87 * age) * DAY - ((i * 137) % 400) * MINUTE);
    if (isAcknowledged) createdAt = new Date(now - (50 + fromEnd * 25) * MINUTE);
    if (isTriggered) createdAt = new Date(now - (4 + fromEnd * 9) * MINUTE);

    const escalated = i % 5 === 0 && !isTriggered;
    const minutesToAcknowledge = escalated ? 9 + (i % 6) : 2 + (i % 5);
    const minutesToResolve = minutesToAcknowledge + 12 + ((i * 11) % 70);

    const acknowledgedAt = isTriggered
      ? null
      : new Date(createdAt.getTime() + minutesToAcknowledge * MINUTE);
    const resolvedAt =
      isTriggered || isAcknowledged
        ? null
        : new Date(createdAt.getTime() + minutesToResolve * MINUTE);

    let status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED' = 'RESOLVED';
    if (isAcknowledged) status = 'ACKNOWLEDGED';
    if (isTriggered) status = 'TRIGGERED';

    const dedupKey = `${problem.service.toLowerCase().replace(/\s+/g, '-')}-${number}`;
    const alertCount = 1 + ((i * 3) % 6);
    const alerts: Prisma.AlertCreateManyIncidentInput[] = [];
    for (let a = 0; a < alertCount; a++) {
      alerts.push({
        title: problem.title,
        severity: problem.severity,
        status: 'TRIGGERED',
        dedupKey,
        deduplicated: a > 0,
        payload: {
          title: problem.title,
          dedup_key: dedupKey,
          severity: problem.severity.toLowerCase(),
          details: { region: 'ap-south-1', host: `node-${(i % 4) + 1}` },
        },
        receivedAt: new Date(createdAt.getTime() + a * 2 * MINUTE),
        serviceId: service.id,
      });
    }

    const incident = await prisma.incident.create({
      data: {
        number,
        title: problem.title,
        description: `Reported by monitoring for ${problem.service}.`,
        severity: problem.severity,
        status,
        dedupKey,
        createdAt,
        lastAlertAt: new Date(createdAt.getTime() + (alertCount - 1) * 2 * MINUTE),
        acknowledgedAt,
        acknowledgedById: acknowledgedAt ? (escalated ? resolver.id : firstResponder.id) : null,
        resolvedAt,
        resolvedById: resolvedAt ? resolver.id : null,
        currentStepPosition: escalated ? 2 : 1,
        organizationId,
        serviceId: service.id,
        alerts: { createMany: { data: alerts } },
      },
    });

    const firstNotification = await prisma.notification.create({
      data: {
        incidentId: incident.id,
        userId: firstResponder.id,
        stepPosition: 1,
        status: isTriggered ? 'SENT' : 'DELIVERED',
        createdAt: new Date(createdAt.getTime() + 2000),
      },
    });
    notificationCount++;

    const events = [
      { type: 'CREATED', actorType: 'INTEGRATION', actorId: null, message: 'Incident created from alert', createdAt },
      {
        type: 'NOTIFICATION_SENT',
        actorType: 'SYSTEM',
        actorId: null,
        message: `Email sent to ${firstResponder.name}`,
        createdAt: new Date(createdAt.getTime() + 2000),
        metadata: { notificationId: firstNotification.id, status: firstNotification.status },
      },
    ] as {
      type: 'CREATED' | 'NOTIFICATION_SENT' | 'NOTIFICATION_DELIVERED' | 'ESCALATED' | 'ACKNOWLEDGED' | 'COMMENT' | 'RESOLVED';
      actorType: 'INTEGRATION' | 'SYSTEM' | 'USER';
      actorId: string | null;
      message: string;
      createdAt: Date;
      metadata?: object;
    }[];

    if (!isTriggered) {
      events.push({
        type: 'NOTIFICATION_DELIVERED',
        actorType: 'SYSTEM',
        actorId: null,
        message: `Email delivered to ${firstResponder.name}`,
        createdAt: new Date(createdAt.getTime() + 6000),
      });
    }

    if (escalated) {
      const escalatedAt = new Date(createdAt.getTime() + 5 * MINUTE);
      await prisma.notification.create({
        data: {
          incidentId: incident.id,
          userId: resolver.id,
          stepPosition: 2,
          status: 'DELIVERED',
          createdAt: escalatedAt,
        },
      });
      notificationCount++;
      events.push(
        { type: 'ESCALATED', actorType: 'SYSTEM', actorId: null, message: 'Nobody responded. Escalated to step 2', createdAt: escalatedAt },
        { type: 'NOTIFICATION_SENT', actorType: 'SYSTEM', actorId: null, message: `Email sent to ${resolver.name}`, createdAt: new Date(escalatedAt.getTime() + 2000) },
      );
    }

    if (acknowledgedAt) {
      const person = escalated ? resolver : firstResponder;
      events.push({
        type: 'ACKNOWLEDGED',
        actorType: 'USER',
        actorId: person.id,
        message: `Acknowledged by ${person.name}`,
        createdAt: acknowledgedAt,
      });
      if (i % 2 === 0) {
        events.push({
          type: 'COMMENT',
          actorType: 'USER',
          actorId: person.id,
          message: COMMENTS[i % COMMENTS.length],
          createdAt: new Date(acknowledgedAt.getTime() + 3 * MINUTE),
        });
      }
    }

    if (resolvedAt) {
      events.push({
        type: 'RESOLVED',
        actorType: 'USER',
        actorId: resolver.id,
        message: `Resolved by ${resolver.name}`,
        createdAt: resolvedAt,
      });
    }

    await prisma.incidentEvent.createMany({
      data: events.map((event) => ({ ...event, incidentId: incident.id })),
    });
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { incidentCounter: INCIDENT_COUNT },
  });

  console.log('');
  console.log(`Seeded "${ORG_NAME}"`);
  console.log(`  ${PEOPLE.length} people, ${TEAMS.length} teams, 3 schedules, 3 escalation policies`);
  console.log(`  ${SERVICES.length} services, ${INCIDENT_COUNT} incidents, ${notificationCount} notifications`);
  console.log('');
  console.log('Log in with any of these (same password for all):');
  for (const person of PEOPLE) {
    console.log(`  ${person.role.padEnd(9)} ${emailFor(person.key)}`);
  }
  console.log(`  password  ${PASSWORD}`);
  console.log('');
  console.log('API keys (shown only here):');
  for (const apiKey of apiKeys) {
    console.log(`  ${apiKey.service.padEnd(18)} ${apiKey.key}`);
  }
  console.log('');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
