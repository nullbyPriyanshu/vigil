import { Module } from '@nestjs/common';
import { ApiKeysModule } from 'src/api-keys/api-keys.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { ApiKeyGuard } from './apiKey.guard';
import { RateLimiter } from './rateLimiter';

@Module({
  imports: [ApiKeysModule],
  controllers: [AlertsController],
  providers: [AlertsService, ApiKeyGuard, RateLimiter],
})
export class AlertsModule {}
