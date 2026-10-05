import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { OptionalAuthGuard } from 'src/auth/optional-auth.guard';
import { setAuthCookies } from 'src/auth/utils/auth-cookies';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto } from './dto/acceptInvitation.dto';
import { CreateInvitationDto } from './dto/createInvitation.dto';

type AuthedRequest = Request & { user: CurrentUserPayload };
type MaybeAuthedRequest = Request & { user?: CurrentUserPayload };

@Controller('organization/invitations')
@UseGuards(AuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  async createInvitation(
    @Req() req: AuthedRequest,
    @Body() dto: CreateInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.invitationsService.createInvitation(
      req.user.userId,
      req.user.organizationId,
      dto,
    );
    // 201 when an invitation was created, 200 when there was nothing to
    // create because they're already a member.
    res.status('alreadyMember' in result ? HttpStatus.OK : HttpStatus.CREATED);
    return result;
  }

  @Get()
  listInvitations(@Req() req: AuthedRequest) {
    return this.invitationsService.listInvitations(
      req.user.userId,
      req.user.organizationId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvitation(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.invitationsService.revokeInvitation(
      req.user.userId,
      req.user.organizationId,
      id,
    );
  }
}

// The invited person's side. Public, because they may not have an account.
@Controller('invitations')
export class PublicInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get(':token')
  previewInvitation(@Param('token') token: string) {
    return this.invitationsService.previewInvitation(token);
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalAuthGuard)
  async acceptInvitation(
    @Req() req: MaybeAuthedRequest,
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, ...rest } =
      await this.invitationsService.acceptInvitation(token, dto, req.user);

    // The web app logs in with cookies; the access token is also returned
    // for clients that send it as a Bearer header instead.
    setAuthCookies(res, { accessToken, refreshToken });
    return { accessToken, ...rest };
  }
}
