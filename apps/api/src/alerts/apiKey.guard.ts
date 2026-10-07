import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiKeysService } from 'src/api-keys/api-keys.service';
import { RateLimiter } from './rateLimiter';

export type CurrentApiKey = {
  id: string;
  serviceId: string;
  organizationId: string;
};

export type ApiKeyRequest = Request & { apiKey: CurrentApiKey };

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    const key = request.headers['x-vigil-key'];
    if (typeof key !== 'string' || key === '') {
      throw new UnauthorizedException('Missing X-Vigil-Key header');
    }

    const apiKey = await this.apiKeysService.findActiveKey(key);
    if (!apiKey) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    const secondsToWait = await this.rateLimiter.getSecondsToWait(apiKey.id);
    if (secondsToWait > 0) {
      response.setHeader('Retry-After', secondsToWait);
      throw new HttpException(
        `Rate limit reached. Try again in ${secondsToWait} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    request.apiKey = apiKey;
    return true;
  }
}
