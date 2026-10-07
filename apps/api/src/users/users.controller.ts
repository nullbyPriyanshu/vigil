import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { REFRESH_TOKEN_COOKIE } from 'src/auth/auth.constants';
import { UsersService } from './users.service';
import { UpdateUserProfileDto } from './dto/updateUserProfile.dto';
import { UpdateUserPasswordDto } from './dto/updateUserPassword.dto';
import { UpdateUserEmailDto } from './dto/updateUserEmail.dto';
import { DeleteAccountDto } from './dto/deleteAccount.dto';
import { clearAuthCookies } from 'src/auth/utils/auth-cookies';

type AuthedRequest = Request & { user: CurrentUserPayload };

@Controller('user')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getUserProfile(@Req() req: AuthedRequest) {
    return this.usersService.getUserProfile(req.user.userId);
  }

  @Patch('profile')
  updateUserProfile(
    @Req() req: AuthedRequest,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateUserProfile(req.user.userId, dto);
  }

  @Patch('profile/update-password')
  @HttpCode(HttpStatus.OK)
  updateUserPassword(
    @Req() req: AuthedRequest,
    @Body() dto: UpdateUserPasswordDto,
  ) {
    return this.usersService.updateUserPassword(
      req.user.userId,
      dto,
      req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined,
    );
  }

  @Patch('profile/update-email')
  updateUserEmail(@Req() req: AuthedRequest, @Body() dto: UpdateUserEmailDto) {
    return this.usersService.updateUserEmail(req.user.userId, dto);
  }

  @Delete('profile')
  async deleteAccount(
    @Req() req: AuthedRequest,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.usersService.deleteAccount(req.user.userId, dto);
    clearAuthCookies(res);
    return result;
  }
}
