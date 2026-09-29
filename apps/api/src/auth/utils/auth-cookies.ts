import type { CookieOptions, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
} from '../auth.constants';

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions,
    maxAge: ACCESS_TOKEN_TTL_MS,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseOptions);
}
