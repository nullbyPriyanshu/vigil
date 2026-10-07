import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  handleResendEvent(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') id?: string,
    @Headers('svix-timestamp') timestamp?: string,
    @Headers('svix-signature') signature?: string,
  ) {
    if (!req.rawBody || !id || !timestamp || !signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    return this.webhooksService.handleResendEvent(req.rawBody.toString(), {
      id,
      timestamp,
      signature,
    });
  }
}
