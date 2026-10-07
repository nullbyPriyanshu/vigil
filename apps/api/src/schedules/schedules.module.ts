import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MembersModule } from 'src/members/members.module';
import { OnCallController, SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [AuthModule, MembersModule],
  controllers: [SchedulesController, OnCallController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
