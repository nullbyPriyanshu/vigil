import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from 'src/auth/auth.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
