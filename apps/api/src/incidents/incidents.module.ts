import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { EscalationModule } from 'src/escalation/escalation.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [AuthModule, RealtimeModule, EscalationModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
