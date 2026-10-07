import { Module } from '@nestjs/common';
import { IncidentsModule } from 'src/incidents/incidents.module';
import { ActionLinksController } from './action-links.controller';
import { ActionLinksService } from './action-links.service';

@Module({
  imports: [IncidentsModule],
  controllers: [ActionLinksController],
  providers: [ActionLinksService],
})
export class ActionLinksModule {}
