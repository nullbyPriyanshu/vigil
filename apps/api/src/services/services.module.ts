import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MembersModule } from 'src/members/members.module';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [AuthModule, MembersModule],
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
