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

// What the guard attaches to the request once the key checks out.
export type CurrentApiKey = {
  id: string;
  serviceId: string;
  organizationId: string;
};

export type ApiKeyRequest = Request & { apiKey: CurrentApiKey };

// Protects the alert endpoints. Machines don't log in, so there's no JWT
// here: the X-Vigil-Key header is the whole identity.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<ApiKeyRequest>();

    const rawKey = request.headers['x-vigil-key'];
    if (typeof rawKey !== 'string' || rawKey === '') {
      throw new UnauthorizedException('Missing X-Vigil-Key header');
    }

    const apiKey = await this.apiKeysService.findActiveKey(rawKey);
    if (!apiKey) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    const waitSeconds = this.rateLimiter.check(apiKey.id);
    if (waitSeconds > 0) {
      http.getResponse<Response>().setHeader('Retry-After', waitSeconds);
      throw new HttpException(
        `Rate limit reached. Try again in ${waitSeconds} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    request.apiKey = apiKey;
    return true;
  }
}
