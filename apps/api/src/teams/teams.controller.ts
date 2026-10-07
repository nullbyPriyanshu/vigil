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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { TeamsService } from './teams.service';
import { AddTeamMemberDto } from './dto/addTeamMember.dto';
import { CreateTeamDto } from './dto/createTeam.dto';
import { UpdateTeamDto } from './dto/updateTeam.dto';

type AuthedRequest = Request & { user: CurrentUserPayload };

@Controller('teams')
@UseGuards(AuthGuard, RolesGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  listTeams(@Req() req: AuthedRequest) {
    return this.teamsService.listTeams(req.user.organizationId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  createTeam(@Req() req: AuthedRequest, @Body() dto: CreateTeamDto) {
    return this.teamsService.createTeam(
      req.user.userId,
      req.user.organizationId,
      dto,
    );
  }

  @Get(':id')
  getTeam(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.getTeam(req.user.organizationId, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  updateTeam(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.updateTeam(
      req.user.userId,
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async deleteTeam(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.teamsService.deleteTeam(
      req.user.userId,
      req.user.organizationId,
      id,
    );
  }

  @Post(':id/members')
  @Roles('OWNER', 'ADMIN')
  addTeamMember(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addTeamMember(
      req.user.userId,
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async removeTeamMember(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('force') force?: string,
  ) {
    await this.teamsService.removeTeamMember(
      req.user.userId,
      req.user.organizationId,
      id,
      userId,
      force === 'true',
    );
  }
}
