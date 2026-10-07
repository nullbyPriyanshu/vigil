import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { EscalationProcessor } from './escalation.processor';
import { ESCALATION_QUEUE, EscalationService } from './escalation.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: ESCALATION_QUEUE }),
    NotificationsModule,
    RealtimeModule,
  ],
  providers: [EscalationService, EscalationProcessor],
  exports: [EscalationService],
})
export class EscalationModule {}
