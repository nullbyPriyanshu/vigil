import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { IncidentStatus, Severity } from 'src/generated/prisma/enums';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a whole number' })
  @Min(1, { message: 'page starts at 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be a whole number' })
  @Min(1, { message: 'pageSize must be at least 1' })
  @Max(100, { message: 'pageSize must be at most 100' })
  pageSize: number = 25;
}

export class ListIncidentsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(IncidentStatus, {
    message: 'status must be TRIGGERED, ACKNOWLEDGED or RESOLVED',
  })
  status?: IncidentStatus;

  @IsOptional()
  @IsUUID(undefined, { message: 'service must be a service id' })
  service?: string;

  @IsOptional()
  @IsEnum(Severity, { message: 'severity must be CRITICAL, HIGH or LOW' })
  severity?: Severity;
}
