import {
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
import { AlertsService, type IngestResult } from './alerts.service';
import { ApiKeyGuard, type ApiKeyRequest } from './apiKey.guard';

const MAX_BODY_BYTES = 64 * 1024;

// The endpoints machines call. No login: the X-Vigil-Key header says which
// service the alert is for.
@Controller('alerts')
@UseGuards(ApiKeyGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  async createAlert(
    @Req() req: ApiKeyRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertBodyIsSmallEnough(body);
    const result = await this.alertsService.ingestAlert(
      req.apiKey,
      body,
      idempotencyKey,
    );
    return this.respond(res, result);
  }

  @Post(':source')
  async createAlertFromSource(
    @Req() req: ApiKeyRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('source') source: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertBodyIsSmallEnough(body);
    const result = await this.alertsService.ingestFromSource(
      req.apiKey,
      source,
      body,
      idempotencyKey,
    );
    return this.respond(res, result);
  }

  // 201 when a new incident was created, 200 for everything else.
  private respond(res: Response, result: IngestResult) {
    res.status(result.created ? 201 : 200);
    return result.body;
  }

  private assertBodyIsSmallEnough(body: unknown) {
    const bytes = Buffer.byteLength(JSON.stringify(body ?? {}));
    if (bytes > MAX_BODY_BYTES) {
      throw new PayloadTooLargeException('The alert body is limited to 64 KB');
    }
  }
}
