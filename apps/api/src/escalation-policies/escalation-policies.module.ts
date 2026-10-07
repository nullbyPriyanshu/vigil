import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MembersModule } from 'src/members/members.module';
import { EscalationPoliciesController } from './escalation-policies.controller';
import { EscalationPoliciesService } from './escalation-policies.service';

@Module({
  imports: [AuthModule, MembersModule],
  controllers: [EscalationPoliciesController],
  providers: [EscalationPoliciesService],
})
export class EscalationPoliciesModule {}
