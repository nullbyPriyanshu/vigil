import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard, CurrentUserPayload } from 'src/auth/auth.guard';
import { REFRESH_TOKEN_COOKIE } from 'src/auth/auth.constants';
import { UsersService } from './users.service';
import { UpdateUserProfileDto } from './dto/updateUserProfile.dto';
import { UpdateUserPasswordDto } from './dto/updateUserPassword.dto';

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
}
