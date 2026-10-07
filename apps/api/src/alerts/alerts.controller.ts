import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  PayloadTooLargeException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AlertsService } from './alerts.service';
import { ApiKeyGuard, type ApiKeyRequest } from './apiKey.guard';
import { CreateAlertDto } from './dto/createAlert.dto';
import { fromGrafana, fromSentry, fromUptimeRobot } from './sources';

const MAX_BODY_BYTES = 64 * 1024;

@Controller('alerts')
@UseGuards(ApiKeyGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  async createAlert(
    @Req() req: ApiKeyRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: CreateAlertDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const payload = req.body as object;
    this.checkBodySize(payload);

    const result = await this.alertsService.createAlert(
      req.apiKey,
      dto,
      payload,
      idempotencyKey,
    );

    res.status(result.created ? 201 : 200);
    return result.body;
  }

  @Post(':source')
  async createAlertFromSource(
    @Req() req: ApiKeyRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('source') source: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const payload = (req.body ?? {}) as object;
    this.checkBodySize(payload);

    let dto: CreateAlertDto | null = null;
    if (source === 'sentry') {
      dto = fromSentry(payload);
    } else if (source === 'grafana') {
      dto = fromGrafana(payload);
    } else if (source === 'uptimerobot') {
      dto = fromUptimeRobot(payload);
    } else {
      throw new BadRequestException(
        `Unsupported source "${source}". Use sentry, grafana or uptimerobot`,
      );
    }

    if (!dto) {
      throw new BadRequestException(
        `This doesn't look like a ${source} webhook payload`,
      );
    }

    const result = await this.alertsService.createAlert(
      req.apiKey,
      dto,
      payload,
      idempotencyKey,
    );

    res.status(result.created ? 201 : 200);
    return result.body;
  }

  private checkBodySize(payload: object) {
    const bytes = Buffer.byteLength(JSON.stringify(payload));
    if (bytes > MAX_BODY_BYTES) {
      throw new PayloadTooLargeException('The alert body is limited to 64 KB');
    }
  }
}
