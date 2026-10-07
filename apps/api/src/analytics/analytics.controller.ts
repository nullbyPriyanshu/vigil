import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { AnalyticsService } from './analytics.service';

type AuthedRequest = Request & { user: CurrentUserPayload };

function parseDays(days: string | undefined, defaultDays: number) {
  if (days === undefined) {
    return defaultDays;
  }
  if (days !== '7' && days !== '30' && days !== '90') {
    throw new BadRequestException('days must be 7, 30 or 90');
  }
  return Number(days);
}

@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary(@Req() req: AuthedRequest, @Query('days') days?: string) {
    return this.analyticsService.getSummary(
      req.user.userId,
      req.user.organizationId,
      parseDays(days, 7),
    );
  }

  @Get('incidents-over-time')
  getIncidentsOverTime(
    @Req() req: AuthedRequest,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.getIncidentsOverTime(
      req.user.userId,
      req.user.organizationId,
      parseDays(days, 30),
    );
  }

  @Get('by-service')
  getByService(@Req() req: AuthedRequest, @Query('days') days?: string) {
    return this.analyticsService.getByService(
      req.user.userId,
      req.user.organizationId,
      parseDays(days, 30),
    );
  }
}
