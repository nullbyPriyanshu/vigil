import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MembersModule } from 'src/members/members.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [AuthModule, MembersModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
