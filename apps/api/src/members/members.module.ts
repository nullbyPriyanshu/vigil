import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [AuthModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
