import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { CreateOnboardingServiceDto } from './dto/createOnboardingService.dto';
import { OnboardingService } from './onboarding.service';

type AuthedRequest = Request & { user: CurrentUserPayload };

@Controller('onboarding')
@UseGuards(AuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('service')
  @Roles('OWNER', 'ADMIN')
  createService(
    @Req() req: AuthedRequest,
    @Body() dto: CreateOnboardingServiceDto,
  ) {
    return this.onboardingService.createService(
      req.user.userId,
      req.user.organizationId,
      dto,
    );
  }
}
