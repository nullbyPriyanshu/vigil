import { Module } from '@nestjs/common';
import { MailModule } from 'src/mail/mail.module';
import { SchedulesModule } from 'src/schedules/schedules.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [MailModule, SchedulesModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
