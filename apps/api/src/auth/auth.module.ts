import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { ACCESS_TOKEN_TTL_MS } from './auth.constants';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // getOrThrow: crash at startup if JWT_SECRET is missing, instead of
        // silently signing tokens with an undefined secret.
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // Must match the access-token cookie lifetime.
          expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
        },
      }),
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  // Other modules that use @UseGuards(AuthGuard) need JwtService.
  exports: [JwtModule],
})
export class AuthModule {}
