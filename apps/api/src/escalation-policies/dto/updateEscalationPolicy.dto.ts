import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StepDto } from './createEscalationPolicy.dto';

export class UpdateEscalationPolicyDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Policy name must be at least 2 characters' })
  @MaxLength(80, { message: 'Policy name must be at most 80 characters' })
  name?: string;

  @IsOptional()
  @IsInt({ message: 'repeatCount must be a whole number' })
  @Min(0, { message: 'repeatCount cannot be negative' })
  @Max(10, { message: 'repeatCount must be at most 10' })
  repeatCount?: number;

  @IsOptional()
  @IsArray({ message: 'steps must be a list' })
  @ArrayMinSize(1, { message: 'A policy needs at least one step' })
  @ArrayMaxSize(20, { message: 'A policy can have at most 20 steps' })
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps?: StepDto[];
}
