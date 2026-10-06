import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { EscalationPoliciesModule } from 'src/escalation-policies/escalation-policies.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [AuthModule, EscalationPoliciesModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
