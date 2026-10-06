import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
