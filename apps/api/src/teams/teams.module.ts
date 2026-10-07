import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MembersModule } from 'src/members/members.module';
import { SchedulesModule } from 'src/schedules/schedules.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [AuthModule, MembersModule, SchedulesModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
