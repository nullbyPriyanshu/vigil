import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { CreateNoteDto } from './dto/createNote.dto';
import { ListIncidentsDto, PaginationDto } from './dto/listIncidents.dto';
import { ResolveIncidentDto } from './dto/resolveIncident.dto';
import { IncidentsService } from './incidents.service';

type AuthedRequest = Request & { user: CurrentUserPayload };

@Controller('incidents')
@UseGuards(AuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  listIncidents(@Req() req: AuthedRequest, @Query() query: ListIncidentsDto) {
    return this.incidentsService.listIncidents(req.user.organizationId, query);
  }

  @Get(':number')
  getIncident(
    @Req() req: AuthedRequest,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.incidentsService.getIncidentByNumber(
      req.user.organizationId,
      number,
    );
  }

  @Get(':id/events')
  listEvents(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.incidentsService.listEvents(req.user.organizationId, id);
  }

  @Get(':id/alerts')
  listAlerts(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.incidentsService.listAlerts(req.user.organizationId, id, query);
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN', 'RESPONDER')
  acknowledge(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.incidentsService.acknowledge(
      req.user.userId,
      req.user.organizationId,
      id,
    );
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN', 'RESPONDER')
  resolve(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveIncidentDto,
  ) {
    return this.incidentsService.resolve(
      req.user.userId,
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Post(':id/notes')
  @Roles('OWNER', 'ADMIN', 'RESPONDER')
  addNote(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.incidentsService.addNote(
      req.user.userId,
      req.user.organizationId,
      id,
      dto,
    );
  }
}
