import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EscalationTargetType } from 'src/generated/prisma/enums';

export class StepDto {
  @IsInt({ message: 'Step position must be a whole number' })
  @Min(1, { message: 'Step position starts at 1' })
  position!: number;

  @IsInt({ message: 'Step delay must be a whole number of minutes' })
  @Min(1, { message: 'Step delay must be at least 1 minute' })
  @Max(1440, { message: 'Step delay must be at most 1440 minutes' })
  delayMinutes!: number;

  @IsEnum(EscalationTargetType, {
    message: 'Step targetType must be USER, TEAM or SCHEDULE',
  })
  targetType!: EscalationTargetType;

  @IsUUID(undefined, { message: 'Step targetId must be a valid id' })
  targetId!: string;
}

export class CreateEscalationPolicyDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Policy name must be at least 2 characters' })
  @MaxLength(80, { message: 'Policy name must be at most 80 characters' })
  name!: string;

  @IsOptional()
  @IsInt({ message: 'repeatCount must be a whole number' })
  @Min(0, { message: 'repeatCount cannot be negative' })
  @Max(10, { message: 'repeatCount must be at most 10' })
  repeatCount?: number;

  @IsArray({ message: 'steps must be a list' })
  @ArrayMinSize(1, { message: 'A policy needs at least one step' })
  @ArrayMaxSize(20, { message: 'A policy can have at most 20 steps' })
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps!: StepDto[];
}
