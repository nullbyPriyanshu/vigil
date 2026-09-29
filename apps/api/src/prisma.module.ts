import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global means every module can inject PrismaService without importing this
// module, and the whole app shares ONE database connection pool.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
