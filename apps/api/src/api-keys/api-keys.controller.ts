import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/createApiKey.dto';

type AuthedRequest = Request & { user: CurrentUserPayload };

@Controller('services/:id/keys')
@UseGuards(AuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  listKeys(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) serviceId: string,
  ) {
    return this.apiKeysService.listKeys(
      req.user.userId,
      req.user.organizationId,
      serviceId,
    );
  }

  @Post()
  createKey(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) serviceId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.createKey(
      req.user.userId,
      req.user.organizationId,
      serviceId,
      dto,
    );
  }

  @Delete(':keyId')
  revokeKey(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) serviceId: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ) {
    return this.apiKeysService.revokeKey(
      req.user.userId,
      req.user.organizationId,
      serviceId,
      keyId,
    );
  }
}
