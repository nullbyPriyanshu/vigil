import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from './auth.constants';
import type { CurrentUserPayload, JwtPayload } from './auth.guard';

type MaybeAuthedRequest = Request & { user?: CurrentUserPayload };

// For endpoints that work both logged in and logged out. If the request
// carries a valid access token, `req.user` is filled in exactly like
// AuthGuard does; if not, the request still goes through with no user.
// It never rejects anyone, so the handler decides what a visitor may do.
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MaybeAuthedRequest>();

    const [type, bearer] = request.headers.authorization?.split(' ') ?? [];
    const token =
      (request.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ??
      (type === 'Bearer' ? bearer : undefined);

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
        request.user = {
          userId: payload.sub,
          organizationId: payload.orgId,
          role: payload.role,
        };
      } catch {
        // An expired or invalid token just means "not logged in" here.
      }
    }

    return true;
  }
}
