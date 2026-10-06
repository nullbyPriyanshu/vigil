import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MembersModule } from 'src/members/members.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [AuthModule, MembersModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  // The alerts module checks incoming keys with this service.
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
