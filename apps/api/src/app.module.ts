import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { PrismaModule } from './prisma.module';
import { UsersModule } from './users/users.module';
import { MembersModule } from './members/members.module';
import { InvitationsModule } from './invitations/invitations.module';
import { TeamsModule } from './teams/teams.module';
import { EscalationPoliciesModule } from './escalation-policies/escalation-policies.module';
import { ServicesModule } from './services/services.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AlertsModule } from './alerts/alerts.module';
import { IncidentsModule } from './incidents/incidents.module';
import { SchedulesModule } from './schedules/schedules.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ActionLinksModule } from './action-links/action-links.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RealtimeModule } from './realtime/realtime.module';
import { EscalationModule } from './escalation/escalation.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { DemoModule } from './demo/demo.module';
import { MonitorsModule } from './monitors/monitors.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(
          config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        );

        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
            db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
          },
        };
      },
    }),
    RedisModule,
    PrismaModule,
    AuthModule,
    OrganizationModule,
    UsersModule,
    MembersModule,
    InvitationsModule,
    TeamsModule,
    EscalationPoliciesModule,
    ServicesModule,
    ApiKeysModule,
    AlertsModule,
    IncidentsModule,
    SchedulesModule,
    NotificationsModule,
    ActionLinksModule,
    WebhooksModule,
    RealtimeModule,
    EscalationModule,
    AnalyticsModule,
    OnboardingModule,
    DemoModule,
    HealthModule,
    MonitorsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
