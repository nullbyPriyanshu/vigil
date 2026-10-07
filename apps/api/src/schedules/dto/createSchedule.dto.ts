import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RotationType } from 'src/generated/prisma/enums';

export class CreateScheduleDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Schedule name must be at least 2 characters' })
  @MaxLength(80, { message: 'Schedule name must be at most 80 characters' })
  name!: string;

  @IsUUID(undefined, { message: 'teamId must be a valid team id' })
  teamId!: string;

  @IsTimeZone({ message: 'timezone must be a valid IANA timezone' })
  timezone!: string;

  @IsEnum(RotationType, { message: 'rotationType must be DAILY or WEEKLY' })
  rotationType!: RotationType;

  @IsOptional()
  @IsInt({ message: 'handoffDay must be a number from 0 (Sunday) to 6' })
  @Min(0, { message: 'handoffDay must be a number from 0 (Sunday) to 6' })
  @Max(6, { message: 'handoffDay must be a number from 0 (Sunday) to 6' })
  handoffDay?: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'handoffTime must look like 10:00',
  })
  handoffTime!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must look like 2026-01-05',
  })
  startDate!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique({ message: 'participantIds must not repeat a user' })
  @IsUUID(undefined, { each: true, message: 'participantIds must be user ids' })
  participantIds?: string[];
}
