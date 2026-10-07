import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RotationType } from 'src/generated/prisma/enums';

export class UpdateScheduleDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Schedule name must be at least 2 characters' })
  @MaxLength(80, { message: 'Schedule name must be at most 80 characters' })
  name?: string;

  @IsOptional()
  @IsTimeZone({ message: 'timezone must be a valid IANA timezone' })
  timezone?: string;

  @IsOptional()
  @IsEnum(RotationType, { message: 'rotationType must be DAILY or WEEKLY' })
  rotationType?: RotationType;

  @IsOptional()
  @IsInt({ message: 'handoffDay must be a number from 0 (Sunday) to 6' })
  @Min(0, { message: 'handoffDay must be a number from 0 (Sunday) to 6' })
  @Max(6, { message: 'handoffDay must be a number from 0 (Sunday) to 6' })
  handoffDay?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'handoffTime must look like 10:00',
  })
  handoffTime?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must look like 2026-01-05',
  })
  startDate?: string;
}
