import { Processor, WorkerHost } from '@nestjs/bullmq';
import { MONITORS_QUEUE, MonitorsService } from './monitors.service';

@Processor(MONITORS_QUEUE)
export class MonitorsProcessor extends WorkerHost {
  constructor(private readonly monitorsService: MonitorsService) {
    super();
  }

  async process() {
    await this.monitorsService.checkDueMonitors();
  }
}
