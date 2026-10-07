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
import { CreateMonitorDto } from './dto/createMonitor.dto';
import { UpdateMonitorDto } from './dto/updateMonitor.dto';
import { MonitorsService } from './monitors.service';

type AuthedRequest = Request & { user: CurrentUserPayload };

@Controller('monitors')
@UseGuards(AuthGuard, RolesGuard)
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Get()
  listMonitors(@Req() req: AuthedRequest) {
    return this.monitorsService.listMonitors(req.user.organizationId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  createMonitor(@Req() req: AuthedRequest, @Body() dto: CreateMonitorDto) {
    return this.monitorsService.createMonitor(req.user.organizationId, dto);
  }

  @Get(':id')
  getMonitor(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.monitorsService.getMonitor(req.user.organizationId, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  updateMonitor(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMonitorDto,
  ) {
    return this.monitorsService.updateMonitor(req.user.organizationId, id, dto);
  }

  @Post(':id/check')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN', 'RESPONDER')
  checkNow(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.monitorsService.checkNow(req.user.organizationId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  deleteMonitor(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.monitorsService.deleteMonitor(req.user.organizationId, id);
  }
}
