import { IsEnum, IsOptional } from 'class-validator';
import { Severity } from 'src/generated/prisma/enums';

export class TestAlertDto {
  @IsOptional()
  @IsEnum(Severity, { message: 'severity must be CRITICAL, HIGH or LOW' })
  severity?: Severity;
}
