import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { DemoService } from './demo.service';

type AuthedRequest = Request & { user: CurrentUserPayload };

@Controller('demo')
@UseGuards(AuthGuard, RolesGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('seed')
  @Roles('OWNER')
  seed(@Req() req: AuthedRequest) {
    return this.demoService.seed(req.user.userId, req.user.organizationId);
  }
}
