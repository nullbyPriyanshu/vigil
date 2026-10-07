import {
  BadRequestException,
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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { CreateScheduleDto } from './dto/createSchedule.dto';
import {
  AddParticipantDto,
  ReorderParticipantsDto,
} from './dto/participants.dto';
import { UpdateScheduleDto } from './dto/updateSchedule.dto';
import { SchedulesService } from './schedules.service';

type AuthedRequest = Request & { user: CurrentUserPayload };

@Controller('schedules')
@UseGuards(AuthGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  listSchedules(@Req() req: AuthedRequest) {
    return this.schedulesService.listSchedules(req.user.organizationId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  createSchedule(@Req() req: AuthedRequest, @Body() dto: CreateScheduleDto) {
    return this.schedulesService.createSchedule(
      req.user.userId,
      req.user.organizationId,
      dto,
    );
  }

  @Get(':id')
  getSchedule(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulesService.getSchedule(req.user.organizationId, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  updateSchedule(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulesService.updateSchedule(
      req.user.userId,
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async deleteSchedule(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.schedulesService.deleteSchedule(
      req.user.userId,
      req.user.organizationId,
      id,
    );
  }

  @Post(':id/participants')
  @Roles('OWNER', 'ADMIN')
  addParticipant(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.schedulesService.addParticipant(
      req.user.userId,
      req.user.organizationId,
      id,
      dto.userId,
    );
  }

  @Put(':id/participants/order')
  @Roles('OWNER', 'ADMIN')
  reorderParticipants(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderParticipantsDto,
  ) {
    return this.schedulesService.reorderParticipants(
      req.user.userId,
      req.user.organizationId,
      id,
      dto.userIds,
    );
  }

  @Delete(':id/participants/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async removeParticipant(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.schedulesService.removeParticipant(
      req.user.userId,
      req.user.organizationId,
      id,
      userId,
    );
  }

  @Get(':id/on-call')
  getOnCall(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('at') at?: string,
  ) {
    const date = at ? new Date(at) : new Date();
    if (isNaN(date.getTime())) {
      throw new BadRequestException(
        'at must be a date like 2026-01-12T04:30:00Z',
      );
    }
    return this.schedulesService.getOnCall(req.user.organizationId, id, date);
  }

  @Get(':id/upcoming')
  getUpcoming(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('weeks') weeks?: string,
  ) {
    const numberOfWeeks = weeks ? Number(weeks) : 8;
    if (
      !Number.isInteger(numberOfWeeks) ||
      numberOfWeeks < 1 ||
      numberOfWeeks > 52
    ) {
      throw new BadRequestException('weeks must be a number from 1 to 52');
    }
    return this.schedulesService.getUpcoming(
      req.user.organizationId,
      id,
      numberOfWeeks,
    );
  }
}

@Controller('on-call')
@UseGuards(AuthGuard)
export class OnCallController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  listOnCall(@Req() req: AuthedRequest) {
    return this.schedulesService.listOnCall(req.user.organizationId);
  }
}
