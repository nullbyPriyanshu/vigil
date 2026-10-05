import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { clearAuthCookies } from 'src/auth/utils/auth-cookies';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { OrganizationService } from './organization.service';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';
import { TransferOwnershipDto } from './dto/transferOwnership.dto';
import { DeleteOrganizationDto } from './dto/deleteOrganization.dto';

type AuthedRequest = Request & { user: CurrentUserPayload };

@Controller('organization')
@UseGuards(AuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  getOrganization(@Req() req: AuthedRequest) {
    return this.organizationService.getOrganization(req.user.organizationId);
  }

  @Patch()
  @Roles('OWNER', 'ADMIN')
  updateOrganization(
    @Req() req: AuthedRequest,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.updateOrganization(
      req.user.organizationId,
      dto,
    );
  }

  @Post('transfer-ownership')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  transferOwnership(
    @Req() req: AuthedRequest,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.organizationService.transferOwnership(
      req.user.userId,
      req.user.organizationId,
      dto,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER')
  async deleteOrganization(
    @Req() req: AuthedRequest,
    @Body() dto: DeleteOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.organizationService.deleteOrganization(
      req.user.userId,
      req.user.organizationId,
      dto,
    );
    clearAuthCookies(res);
  }

  @Post('onboarding/complete')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN')
  completeOnboarding(@Req() req: AuthedRequest) {
    return this.organizationService.completeOnboarding(req.user.organizationId);
  }
}
