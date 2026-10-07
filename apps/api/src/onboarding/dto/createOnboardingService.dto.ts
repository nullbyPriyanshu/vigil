import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOnboardingServiceDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Service name must be at least 2 characters' })
  @MaxLength(70, { message: 'Service name must be at most 70 characters' })
  name!: string;

  @IsUUID(undefined, { message: 'teamId must be a valid team id' })
  teamId!: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'scheduleId must be a valid schedule id' })
  scheduleId?: string;
}
