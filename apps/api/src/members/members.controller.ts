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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { MembersService } from './members.service';
import { UpdateMemberRoleDto } from './dto/updateMemberRole.dto';

type AuthedRequest = Request & { user: CurrentUserPayload };

@Controller('organization/members')
@UseGuards(AuthGuard, RolesGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  listMembers(@Req() req: AuthedRequest) {
    return this.membersService.listMembers(req.user.organizationId);
  }

  @Patch(':userId')
  @Roles('OWNER', 'ADMIN')
  updateMemberRole(
    @Req() req: AuthedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.membersService.updateMemberRole(
      req.user.userId,
      req.user.organizationId,
      userId,
      dto,
    );
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async removeMember(
    @Req() req: AuthedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.membersService.removeMember(
      req.user.userId,
      req.user.organizationId,
      userId,
    );
  }
}
