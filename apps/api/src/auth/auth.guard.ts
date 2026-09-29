import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Role } from '../generated/prisma/enums';
import { ACCESS_TOKEN_COOKIE } from './auth.constants';

export type JwtPayload = { sub: string; orgId: string; role: Role };

export type CurrentUserPayload = {
  userId: string;
  organizationId: string;
  role: Role;
};

type AuthedRequest = Request & { user?: CurrentUserPayload };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();

    const token = this.fromCookie(request) ?? this.fromHeader(request);

    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      request.user = {
        userId: payload.sub,
        organizationId: payload.orgId,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }

  private fromCookie(request: AuthedRequest): string | undefined {
    return request.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
  }

  private fromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
