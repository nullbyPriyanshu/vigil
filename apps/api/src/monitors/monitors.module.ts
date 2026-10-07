import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AlertsModule } from 'src/alerts/alerts.module';
import { AuthModule } from 'src/auth/auth.module';
import { MonitorsController } from './monitors.controller';
import { MonitorsProcessor } from './monitors.processor';
import { MONITORS_QUEUE, MonitorsService } from './monitors.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: MONITORS_QUEUE }),
    AuthModule,
    AlertsModule,
  ],
  controllers: [MonitorsController],
  providers: [MonitorsService, MonitorsProcessor],
})
export class MonitorsModule {}
