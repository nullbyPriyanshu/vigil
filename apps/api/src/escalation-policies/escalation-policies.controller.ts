import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { EscalationPoliciesService } from './escalation-policies.service';
import { CreateEscalationPolicyDto } from './dto/createEscalationPolicy.dto';
import { UpdateEscalationPolicyDto } from './dto/updateEscalationPolicy.dto';

type AuthedRequest = Request & { user: CurrentUserPayload };

// Everyone in the organization can see policies; only owners and admins
// can change them.
@Controller('escalation-policies')
@UseGuards(AuthGuard, RolesGuard)
export class EscalationPoliciesController {
  constructor(private readonly policiesService: EscalationPoliciesService) {}

  @Get()
  listPolicies(@Req() req: AuthedRequest) {
    return this.policiesService.listPolicies(req.user.organizationId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  createPolicy(
    @Req() req: AuthedRequest,
    @Body() dto: CreateEscalationPolicyDto,
  ) {
    return this.policiesService.createPolicy(
      req.user.userId,
      req.user.organizationId,
      dto,
    );
  }

  @Get(':id')
  getPolicy(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.getPolicy(req.user.organizationId, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  updatePolicy(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEscalationPolicyDto,
  ) {
    return this.policiesService.updatePolicy(
      req.user.userId,
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async deletePolicy(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.policiesService.deletePolicy(
      req.user.userId,
      req.user.organizationId,
      id,
    );
  }
}
