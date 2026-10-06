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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/createService.dto';
import { UpdateServiceDto } from './dto/updateService.dto';

type AuthedRequest = Request & { user: CurrentUserPayload };

// Everyone in the organization can see services; only owners and admins
// can change them.
@Controller('services')
@UseGuards(AuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  listServices(@Req() req: AuthedRequest) {
    return this.servicesService.listServices(req.user.organizationId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  createService(@Req() req: AuthedRequest, @Body() dto: CreateServiceDto) {
    return this.servicesService.createService(
      req.user.userId,
      req.user.organizationId,
      dto,
    );
  }

  @Get(':id')
  getService(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.servicesService.getService(req.user.organizationId, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  updateService(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.updateService(
      req.user.userId,
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async deleteService(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.servicesService.deleteService(
      req.user.userId,
      req.user.organizationId,
      id,
    );
  }
}
