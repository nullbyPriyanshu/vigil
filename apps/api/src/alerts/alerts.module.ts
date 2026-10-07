import { Module } from '@nestjs/common';
import { ApiKeysModule } from 'src/api-keys/api-keys.module';
import { EscalationModule } from 'src/escalation/escalation.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { ApiKeyGuard } from './apiKey.guard';
import { RateLimiter } from './rateLimiter';

@Module({
  imports: [ApiKeysModule, EscalationModule, RealtimeModule],
  controllers: [AlertsController],
  providers: [AlertsService, ApiKeyGuard, RateLimiter],
  exports: [AlertsService],
})
export class AlertsModule {}
