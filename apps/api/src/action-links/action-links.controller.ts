import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ActionLinksService } from './action-links.service';

@Controller('a')
export class ActionLinksController {
  constructor(private readonly actionLinksService: ActionLinksService) {}

  @Get(':token')
  getAction(@Param('token') token: string) {
    return this.actionLinksService.getAction(token);
  }

  @Post(':token')
  @HttpCode(HttpStatus.OK)
  performAction(@Param('token') token: string) {
    return this.actionLinksService.performAction(token);
  }
}
